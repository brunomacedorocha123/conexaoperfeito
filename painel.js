// Configuração do Supabase
const SUPABASE_URL = 'https://gcukalndarlgydmgmmmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let selectedAvatarFile = null;

// Sistema Premium
const PremiumManager = {
    async checkPremiumStatus() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;
            
            console.log('🔍 Verificando status premium para:', user.id);
            
            // Primeiro verificar na tabela de assinaturas
            const { data: subscription, error: subError } = await supabase
                .from('user_subscriptions')
                .select(`
                    id, 
                    status, 
                    expires_at,
                    plan:subscription_plans(name, period_days)
                `)
                .eq('user_id', user.id)
                .eq('status', 'active')
                .gt('expires_at', new Date().toISOString())
                .single();

            if (!subError && subscription) {
                console.log('🎉 Assinatura ativa encontrada:', subscription);
                await this.syncProfileWithSubscription(user.id, subscription);
                return true;
            }

            console.log('ℹ️ Nenhuma assinatura ativa encontrada');
            
            // Verificar se o perfil está correto
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('is_premium, premium_expires_at')
                .eq('id', user.id)
                .single();
            
            if (profileError) {
                console.error('Erro ao verificar perfil:', profileError);
                return false;
            }

            console.log('📊 Status no perfil:', profile);
            
            // Se o perfil diz que é premium mas não tem assinatura, corrigir
            if (profile.is_premium) {
                console.warn('⚠️ Perfil marcado como premium sem assinatura ativa! Corrigindo...');
                await this.fixPremiumStatus(user.id, false);
                return false;
            }
            
            return false;
            
        } catch (error) {
            console.error('❌ Erro na verificação premium:', error);
            return false;
        }
    },

    async syncProfileWithSubscription(userId, subscription) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    is_premium: true,
                    premium_expires_at: subscription.expires_at,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) {
                console.error('❌ Erro ao sincronizar perfil:', error);
            } else {
                console.log('✅ Perfil sincronizado com assinatura');
            }
        } catch (error) {
            console.error('Erro na sincronização:', error);
        }
    },

    async fixPremiumStatus(userId, shouldBePremium) {
        try {
            const { error } = await supabase
                .from('profiles')
                .update({ 
                    is_premium: shouldBePremium,
                    premium_expires_at: shouldBePremium ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() : null,
                    updated_at: new Date().toISOString()
                })
                .eq('id', userId);

            if (error) {
                console.error('❌ Erro ao corrigir status:', error);
            } else {
                console.log('✅ Status premium corrigido para:', shouldBePremium);
            }
        } catch (error) {
            console.error('Erro na correção:', error);
        }
    }
};

// Inicialização
document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando painel...');
    checkAuth();
});

// Verifica se usuário está logado
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error || !user) {
            console.log('❌ Usuário não autenticado, redirecionando...');
            window.location.href = 'login.html';
            return;
        }
        currentUser = user;
        console.log('✅ Usuário autenticado:', user.email);
        
        setupEventListeners();
        await loadUserData();
        await loadProfileData();
        await updatePremiumStatus();
        await updateProfileCompletion();
        await updatePlanStatus();
        await loadInvisibleModeStatus();
        await initGallery(); // ✅ LINHA ADICIONADA PARA A GALERIA
        
    } catch (error) {
        console.error('❌ Erro na autenticação:', error);
        window.location.href = 'login.html';
    }
}

// Configura eventos
function setupEventListeners() {
    console.log('⚙️ Configurando event listeners...');
    
    // Form submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
        console.log('✅ Formulário configurado');
    }

    // Avatar upload
    const avatarButton = document.getElementById('avatarButton');
    const avatarInput = document.getElementById('avatarInput');
    
    if (avatarButton && avatarInput) {
        avatarButton.addEventListener('click', function(e) {
            e.preventDefault();
            console.log('📷 Clicou no botão de avatar');
            avatarInput.click();
        });
        console.log('✅ Botão de avatar configurado');
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarSelect);
        console.log('✅ Input de arquivo configurado');
    }

    // Máscaras para CPF, Telefone e CEP
    const cpfInput = document.getElementById('cpf');
    const phoneInput = document.getElementById('phone');
    const zipCodeInput = document.getElementById('zipCode');

    if (cpfInput) {
        cpfInput.addEventListener('input', maskCPF);
        console.log('✅ Máscara CPF configurada');
    }
    if (phoneInput) {
        phoneInput.addEventListener('input', maskPhone);
        console.log('✅ Máscara telefone configurada');
    }
    if (zipCodeInput) {
        zipCodeInput.addEventListener('input', maskCEP);
        console.log('✅ Máscara CEP configurada');
    }

    // Character count
    const description = document.getElementById('description');
    if (description) {
        description.addEventListener('input', updateCharCount);
        console.log('✅ Contador de caracteres configurado');
    }

    // Menu mobile
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeMobileMenu = document.getElementById('closeMobileMenu');
    const mobileMenu = document.getElementById('mobileMenu');

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', function() {
            if (mobileMenu) mobileMenu.style.display = 'flex';
            console.log('📱 Menu mobile aberto');
        });
    }

    if (closeMobileMenu) {
        closeMobileMenu.addEventListener('click', function() {
            if (mobileMenu) mobileMenu.style.display = 'none';
            console.log('📱 Menu mobile fechado');
        });
    }

    // Logout buttons
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
        console.log('✅ Logout desktop configurado');
    }
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', logout);
        console.log('✅ Logout mobile configurado');
    }

    // Fechar menu ao clicar em links
    document.querySelectorAll('.mobile-nav a').forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.style.display = 'none';
            console.log('📱 Menu mobile fechado via link');
        });
    });

    // Fechar menu com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileMenu) {
            mobileMenu.style.display = 'none';
            console.log('📱 Menu mobile fechado com ESC');
        }
    });

    console.log('🎯 Todos os event listeners configurados');
}

// Máscaras de formulário
function maskCPF(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d)/, '$1.$2');
        value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    e.target.value = value;
}

function maskPhone(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 11) {
        value = value.replace(/(\d{2})(\d)/, '($1) $2');
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
    }
    e.target.value = value;
}

function maskCEP(e) {
    let value = e.target.value.replace(/\D/g, '');
    if (value.length <= 8) {
        value = value.replace(/(\d{5})(\d)/, '$1-$2');
    }
    e.target.value = value;
}
// Atualizar status do plano
async function updatePlanStatus() {
    try {
        const isPremium = await PremiumManager.checkPremiumStatus();
        const planCard = document.getElementById('planStatusCard');
        const planBadge = document.getElementById('planBadge');
        const planDescription = document.getElementById('planDescription');
        const planActions = document.getElementById('planActions');

        if (isPremium) {
            console.log('🎉 Atualizando interface para PREMIUM');
            planCard.classList.add('premium');
            planBadge.textContent = 'PREMIUM';
            planBadge.className = 'plan-badge premium';
            planDescription.textContent = 'Plano Premium com todos os benefícios ativos!';
            planActions.innerHTML = `
                <button class="btn btn-primary" onclick="window.location.href='mensagens.html'">
                    🚀 Ir para Mensagens
                </button>
            `;
            
            const planFeatures = document.querySelector('.plan-features');
            if (planFeatures) {
                planFeatures.innerHTML = `
                    <div class="feature-item">
                        <span class="feature-icon">💬</span>
                        <span class="feature-text">Mensagens ilimitadas</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">🕒</span>
                        <span class="feature-text">Histórico permanente</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">👻</span>
                        <span class="feature-text">Modo invisível</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">👀</span>
                        <span class="feature-text">Ver visitantes</span>
                    </div>
                `;
            }
        } else {
            console.log('ℹ️ Mantendo interface GRATUITA');
            planCard.classList.remove('premium');
            planBadge.textContent = 'GRATUITO';
            planBadge.className = 'plan-badge gratuito';
            planDescription.textContent = 'Plano gratuito com funcionalidades básicas';
            planActions.innerHTML = `
                <a href="princing.html" class="btn btn-primary">⭐ Fazer Upgrade</a>
            `;
        }

        console.log(`✅ Status do plano: ${isPremium ? 'PREMIUM' : 'GRATUITO'}`);
        
        // ✅ LINHA ADICIONADA: Atualizar galeria quando o status mudar
        await toggleGallerySection();
        
    } catch (error) {
        console.error('❌ Erro ao atualizar status do plano:', error);
    }
}
// Atualizar status premium
async function updatePremiumStatus() {
    try {
        const isPremium = await PremiumManager.checkPremiumStatus();
        
        if (isPremium) {
            console.log('✅ Usuário é Premium - adicionando badges');
            
            const userInfo = document.querySelector('.user-info');
            if (userInfo && !userInfo.querySelector('.premium-badge')) {
                const badge = document.createElement('span');
                badge.className = 'premium-badge';
                badge.textContent = '⭐ PREMIUM';
                badge.style.background = 'var(--vermelho-rosado)';
                badge.style.color = 'white';
                badge.style.padding = '2px 8px';
                badge.style.borderRadius = '10px';
                badge.style.fontSize = '0.7rem';
                badge.style.marginLeft = '8px';
                badge.style.fontWeight = 'bold';
                userInfo.appendChild(badge);
            }

            const mobileUserInfo = document.querySelector('.mobile-user-info');
            if (mobileUserInfo && !mobileUserInfo.querySelector('.premium-badge')) {
                const mobileBadge = document.createElement('span');
                mobileBadge.className = 'premium-badge';
                mobileBadge.textContent = '⭐ PREMIUM';
                mobileBadge.style.background = 'var(--vermelho-rosado)';
                mobileBadge.style.color = 'white';
                mobileBadge.style.padding = '4px 12px';
                mobileBadge.style.borderRadius = '10px';
                mobileBadge.style.fontSize = '0.8rem';
                mobileBadge.style.marginTop = '8px';
                mobileBadge.style.fontWeight = 'bold';
                mobileBadge.style.display = 'block';
                mobileUserInfo.appendChild(mobileBadge);
            }
        } else {
            console.log('ℹ️ Usuário é Gratuito');
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status premium:', error);
    }
}

// Atualizar progresso do perfil
async function updateProfileCompletion() {
    try {
        const { data: completion, error } = await supabase
            .rpc('calculate_profile_completion', { user_uuid: currentUser.id });
        
        if (error) {
            console.error('❌ Erro ao calcular completude:', error);
            return;
        }

        const percentage = completion || 0;
        const progressFill = document.getElementById('progressFill');
        const completionPercentage = document.getElementById('completionPercentage');
        const progressText = document.getElementById('progressText');

        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (completionPercentage) completionPercentage.textContent = `${percentage}%`;
        
        if (progressText) {
            if (percentage < 30) {
                progressText.textContent = 'Complete seu perfil para melhorar suas conexões';
            } else if (percentage < 70) {
                progressText.textContent = 'Seu perfil está ficando interessante! Continue...';
            } else if (percentage < 100) {
                progressText.textContent = 'Quase lá! Complete os últimos detalhes';
            } else {
                progressText.textContent = '🎉 Perfil 100% completo!';
            }
        }

        console.log(`📊 Progresso do perfil: ${percentage}%`);
    } catch (error) {
        console.error('❌ Erro ao atualizar progresso:', error);
    }
}

// Carrega dados básicos do usuário
async function loadUserData() {
    try {
        console.log('👤 Carregando dados do usuário...');
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('nickname, avatar_url')
            .eq('id', currentUser.id)
            .single();
        
        if (error && error.code === 'PGRST116') {
            console.log('🆕 Criando perfil novo...');
            await createUserProfile();
            return;
        }
        
        if (profile) {
            const displayName = profile.nickname || currentUser.email.split('@')[0];
            
            // ✅ CORREÇÃO: Atualizar elementos corretamente
            const userNickname = document.getElementById('userNickname');
            const mobileUserNickname = document.getElementById('mobileUserNickname');
            
            if (userNickname) userNickname.textContent = displayName;
            if (mobileUserNickname) mobileUserNickname.textContent = displayName;
            
            console.log('✅ Nickname no header:', displayName);
            
            if (profile.avatar_url) {
                console.log('🖼️ Carregando avatar existente...');
                await loadAvatar(profile.avatar_url);
            } else {
                console.log('❌ Nenhum avatar encontrado');
                showFallbackAvatars();
            }
        } else {
            const fallbackName = currentUser.email.split('@')[0];
            const userNickname = document.getElementById('userNickname');
            const mobileUserNickname = document.getElementById('mobileUserNickname');
            
            if (userNickname) userNickname.textContent = fallbackName;
            if (mobileUserNickname) mobileUserNickname.textContent = fallbackName;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
        
        const fallbackName = currentUser?.email?.split('@')[0] || 'Usuário';
        const userNickname = document.getElementById('userNickname');
        const mobileUserNickname = document.getElementById('mobileUserNickname');
        
        if (userNickname) userNickname.textContent = fallbackName;
        if (mobileUserNickname) mobileUserNickname.textContent = fallbackName;
        
        showNotification('❌ Erro ao carregar dados do perfil', 'error');
    }
}

// Cria perfil do usuário se não existir
async function createUserProfile() {
    try {
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: currentUser.id,
                nickname: currentUser.email.split('@')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (profileError) throw profileError;

        const { error: detailsError } = await supabase
            .from('user_details')
            .insert({
                user_id: currentUser.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        if (detailsError) throw detailsError;
        
        console.log('✅ Perfil criado com sucesso!');
        await loadUserData();
        
    } catch (error) {
        console.error('❌ Erro ao criar perfil:', error);
        showNotification('❌ Erro ao criar perfil.', 'error');
    }
}

// Carrega avatar
async function loadAvatar(avatarPath) {
    try {
        console.log('🔄 Carregando avatar:', avatarPath);
        
        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(avatarPath);

        if (data && data.publicUrl) {
            console.log('✅ URL pública do avatar:', data.publicUrl);
            updateAvatarImages(data.publicUrl);
        } else {
            console.log('❌ Não foi possível obter URL pública');
            showFallbackAvatars();
        }
    } catch (error) {
        console.log('❌ Erro ao carregar avatar:', error);
        showFallbackAvatars();
    }
}

// Atualiza imagens de avatar
function updateAvatarImages(imageUrl) {
    const avatarImgs = document.querySelectorAll('.user-avatar-img');
    const previewImg = document.getElementById('avatarPreviewImg');
    const fallbacks = document.querySelectorAll('.user-avatar-fallback, .avatar-fallback');
    
    console.log('✅ Atualizando avatares com URL:', imageUrl);
    
    avatarImgs.forEach(img => {
        img.src = imageUrl;
        img.style.display = 'block';
        img.onerror = () => {
            console.log('❌ Erro ao carregar imagem do avatar');
            img.style.display = 'none';
        };
    });
    
    if (previewImg) {
        previewImg.src = imageUrl;
        previewImg.style.display = 'block';
        previewImg.onerror = () => {
            console.log('❌ Erro ao carregar preview do avatar');
            previewImg.style.display = 'none';
            const avatarFallback = document.getElementById('avatarFallback');
            if (avatarFallback) avatarFallback.style.display = 'flex';
        };
    }
    
    fallbacks.forEach(fb => {
        fb.style.display = 'none';
    });
}

// Mostra fallback
function showFallbackAvatars() {
    document.querySelectorAll('.user-avatar-fallback, .avatar-fallback').forEach(fb => {
        fb.style.display = 'flex';
    });
}

// Carrega dados do perfil - CORREÇÃO DO EMAIL
async function loadProfileData() {
    try {
        console.log('📋 Carregando dados do perfil...');
        
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profileError && profileError.code === 'PGRST116') {
            await createUserProfile();
            return;
        }

        const { data: userDetails, error: detailsError } = await supabase
            .from('user_details')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (detailsError && detailsError.code === 'PGRST116') {
            await supabase
                .from('user_details')
                .insert({
                    user_id: currentUser.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            return;
        }

        // ✅ CORREÇÃO CRÍTICA: Preencher email automaticamente
        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = currentUser.email || '';
            console.log('✅ E-mail preenchido:', currentUser.email);
        }

        if (profile) {
            // Preencher campos do perfil principal
            const fields = {
                'fullName': profile.full_name,
                'cpf': profile.cpf,
                'birthDate': profile.birth_date,
                'phone': profile.phone,
                'street': profile.street,
                'number': profile.number,
                'neighborhood': profile.neighborhood,
                'city': profile.city,
                'state': profile.state,
                'zipCode': profile.zip_code,
                'nickname': profile.nickname
            };

            for (const [fieldId, value] of Object.entries(fields)) {
                const element = document.getElementById(fieldId);
                if (element) element.value = value || '';
            }
            
            if (profile.city && profile.state && (!userDetails || !userDetails.display_city)) {
                const displayCity = document.getElementById('displayCity');
                if (displayCity) displayCity.value = `${profile.city}, ${profile.state}`;
            }
        }

        if (userDetails) {
            // Preencher campos detalhados
            const detailFields = {
                'displayCity': userDetails.display_city,
                'gender': userDetails.gender,
                'sexualOrientation': userDetails.sexual_orientation,
                'profession': userDetails.profession,
                'education': userDetails.education,
                'zodiac': userDetails.zodiac,
                'lookingFor': userDetails.looking_for,
                'description': userDetails.description,
                'religion': userDetails.religion,
                'drinking': userDetails.drinking,
                'smoking': userDetails.smoking,
                'exercise': userDetails.exercise,
                'exerciseDetails': userDetails.exercise_details,
                'hasPets': userDetails.has_pets,
                'petsDetails': userDetails.pets_details
            };

            for (const [fieldId, value] of Object.entries(detailFields)) {
                const element = document.getElementById(fieldId);
                if (element) element.value = value || '';
            }
            
            // Preencir interesses
            if (userDetails.interests) {
                document.querySelectorAll('input[name="interests"]').forEach(checkbox => {
                    checkbox.checked = userDetails.interests.includes(checkbox.value);
                });
            }
        }

        updateCharCount();
        console.log('✅ Dados do perfil carregados');

    } catch (error) {
        console.error('❌ Erro ao carregar perfil:', error);
        showNotification('❌ Erro ao carregar dados do perfil', 'error');
    }
}

// Handle avatar select
function handleAvatarSelect(event) {
    console.log('📁 Arquivo selecionado:', event.target.files[0]);
    const file = event.target.files[0];
    if (!file) {
        console.log('❌ Nenhum arquivo selecionado');
        return;
    }

    if (file.size > 256000) {
        showNotification('❌ A imagem deve ter no máximo 250KB!', 'error');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showNotification('❌ Selecione uma imagem válida (JPG, PNG, GIF)!', 'error');
        return;
    }

    selectedAvatarFile = file;
    console.log('✅ Arquivo validado:', file.name, file.size, 'bytes');

    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('🖼️ Criando preview da imagem...');
        
        const previewImg = document.getElementById('avatarPreviewImg');
        const fallback = document.getElementById('avatarFallback');
        const avatarImgs = document.querySelectorAll('.user-avatar-img');
        const headerFallbacks = document.querySelectorAll('.user-avatar-fallback');
        
        if (previewImg) {
            previewImg.src = e.target.result;
            previewImg.style.display = 'block';
        }
        if (fallback) fallback.style.display = 'none';
        
        avatarImgs.forEach(img => {
            img.src = e.target.result;
            img.style.display = 'block';
        });
        
        headerFallbacks.forEach(fb => {
            fb.style.display = 'none';
        });
        
        showNotification('✅ Imagem selecionada! Clique em Salvar Perfil para confirmar.', 'success');
    };
    reader.onerror = function() {
        console.error('❌ Erro ao ler arquivo');
        showNotification('❌ Erro ao carregar imagem', 'error');
    };
    reader.readAsDataURL(file);
}

// Upload de avatar - CORREÇÃO COMPLETA
async function uploadAvatar(file) {
    try {
        console.log('📤 Iniciando upload do avatar...');
        
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}_avatar.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        console.log('📁 Fazendo upload para:', filePath);

        // ✅ CORREÇÃO: Verificar se a pasta existe, se não, criar
        try {
            // Listar para forçar criação da pasta
            await supabase.storage
                .from('avatars')
                .list(currentUser.id);
        } catch (e) {
            console.log('📁 Pasta não existe, será criada automaticamente');
        }

        // ✅ CORREÇÃO: Upload simples sem options complexas
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false // Mudar para false para evitar conflitos
            });

        if (error) {
            console.error('❌ Erro no upload:', error);
            
            // ✅ CORREÇÃO: Tentar com upsert true se falhar
            const { data: retryData, error: retryError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file, {
                    upsert: true
                });
                
            if (retryError) {
                console.error('❌ Erro na segunda tentativa:', retryError);
                throw new Error(`Falha no upload: ${retryError.message}`);
            }
            
            console.log('✅ Upload realizado na segunda tentativa');
            return filePath;
        }

        console.log('✅ Upload realizado com sucesso:', data);
        return filePath;

    } catch (error) {
        console.error('❌ Erro completo no upload:', error);
        showNotification('⚠️ Imagem não pôde ser enviada, mas o perfil será salvo.', 'warning');
        return null;
    }
}

// SALVA PERFIL - FUNÇÃO PRINCIPAL COMPLETAMENTE CORRIGIDA
async function saveProfile(event) {
    event.preventDefault();
    console.log('💾 Iniciando salvamento do perfil...');
    
    const saveButton = document.getElementById('saveButton');
    if (!saveButton) {
        console.error('❌ Botão de salvar não encontrado');
        return;
    }
    
    const originalText = saveButton.innerHTML;
    
    try {
        saveButton.innerHTML = '⏳ Salvando...';
        saveButton.disabled = true;

        let avatarPath = null;

        // ✅ CORREÇÃO: Upload da imagem ANTES de salvar o perfil
        if (selectedAvatarFile) {
            console.log('📤 Fazendo upload da imagem...');
            showNotification('📤 Enviando imagem...', 'info');
            try {
                avatarPath = await uploadAvatar(selectedAvatarFile);
                if (avatarPath) {
                    console.log('✅ Upload do avatar realizado:', avatarPath);
                    showNotification('✅ Imagem enviada com sucesso!', 'success');
                }
            } catch (uploadError) {
                console.error('❌ Upload falhou, continuando sem imagem:', uploadError);
                showNotification('⚠️ Imagem não enviada, mas perfil será salvo', 'warning');
            }
        }

        // ✅ CORREÇÃO: Coletar dados do formulário de forma segura
        const getFormValue = (id) => {
            const element = document.getElementById(id);
            return element ? element.value.trim() : '';
        };

        // DADOS DO PERFIL
        const profileData = {
            full_name: getFormValue('fullName'),
            cpf: getFormValue('cpf').replace(/\D/g, ''),
            birth_date: getFormValue('birthDate'),
            phone: getFormValue('phone').replace(/\D/g, ''),
            street: getFormValue('street'),
            number: getFormValue('number'),
            neighborhood: getFormValue('neighborhood'),
            city: getFormValue('city'),
            state: getFormValue('state'),
            zip_code: getFormValue('zipCode').replace(/\D/g, ''),
            nickname: getFormValue('nickname'),
            updated_at: new Date().toISOString()
        };

        // ✅ CORREÇÃO: Adicionar avatar path apenas se upload foi bem sucedido
        if (avatarPath) {
            profileData.avatar_url = avatarPath;
            console.log('✅ Avatar URL adicionado aos dados:', avatarPath);
        }

        // DADOS DETALHADOS
        const userDetailsData = {
            display_city: getFormValue('displayCity'),
            gender: getFormValue('gender'),
            sexual_orientation: getFormValue('sexualOrientation'),
            profession: getFormValue('profession'),
            education: getFormValue('education'),
            zodiac: getFormValue('zodiac'),
            looking_for: getFormValue('lookingFor'),
            description: getFormValue('description'),
            religion: getFormValue('religion'),
            drinking: getFormValue('drinking'),
            smoking: getFormValue('smoking'),
            exercise: getFormValue('exercise'),
            exercise_details: getFormValue('exerciseDetails'),
            has_pets: getFormValue('hasPets'),
            pets_details: getFormValue('petsDetails'),
            updated_at: new Date().toISOString()
        };

        // Interesses
        const selectedInterests = [];
        document.querySelectorAll('input[name="interests"]:checked').forEach(checkbox => {
            selectedInterests.push(checkbox.value);
        });
        userDetailsData.interests = selectedInterests;

        // ✅ CORREÇÃO: Validações melhoradas
        if (!profileData.nickname) {
            showNotification('❌ Informe um nickname!', 'error');
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
            return;
        }
        
        if (!profileData.birth_date) {
            showNotification('❌ Informe a data de nascimento!', 'error');
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
            return;
        }
        
        // Calcula idade
        const birthDate = new Date(profileData.birth_date);
        const today = new Date();
        let age = today.getFullYear() - birthDate.getFullYear();
        const monthDiff = today.getMonth() - birthDate.getMonth();
        
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
            age--;
        }
        
        if (age < 18) {
            showNotification('❌ Você deve ter pelo menos 18 anos!', 'error');
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
            return;
        }
        
        if (!userDetailsData.gender) {
            showNotification('❌ Informe o gênero!', 'error');
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
            return;
        }
        
        if (!userDetailsData.looking_for) {
            showNotification('❌ Informe o que você procura!', 'error');
            saveButton.innerHTML = originalText;
            saveButton.disabled = false;
            return;
        }

        // ✅ CORREÇÃO: Salvar no banco de dados
        console.log('💾 Salvando no banco de dados...');
        showNotification('💾 Salvando dados do perfil...', 'info');

        // Atualiza perfil principal
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: currentUser.id,
                ...profileData
            }, { 
                onConflict: 'id',
                ignoreDuplicates: false
            });

        if (profileError) {
            console.error('❌ Erro ao salvar perfil:', profileError);
            throw new Error(`Erro no perfil: ${profileError.message}`);
        }

        // Atualiza detalhes do usuário
        const { error: detailsError } = await supabase
            .from('user_details')
            .upsert({
                user_id: currentUser.id,
                ...userDetailsData
            }, { 
                onConflict: 'user_id',
                ignoreDuplicates: false
            });

        if (detailsError) {
            console.error('❌ Erro ao salvar detalhes:', detailsError);
            throw new Error(`Erro nos detalhes: ${detailsError.message}`);
        }

        // ✅ CORREÇÃO: Atualizar interface
        const userNickname = document.getElementById('userNickname');
        const mobileUserNickname = document.getElementById('mobileUserNickname');
        
        if (userNickname) userNickname.textContent = profileData.nickname;
        if (mobileUserNickname) mobileUserNickname.textContent = profileData.nickname;
        
        // Reseta o arquivo selecionado
        selectedAvatarFile = null;
        const avatarInput = document.getElementById('avatarInput');
        if (avatarInput) avatarInput.value = '';
        
        console.log('✅ Perfil salvo com sucesso!');
        showNotification('✅ Perfil salvo com sucesso!', 'success');
        
        // ✅ CORREÇÃO: Atualizar progresso e status
        await updateProfileCompletion();
        await updatePremiumStatus();
        await updatePlanStatus();
        
        // Recarrega o avatar se foi atualizado
        if (avatarPath) {
            console.log('🔄 Recarregando avatar atualizado...');
            setTimeout(() => {
                loadAvatar(avatarPath);
            }, 1500);
        }

    } catch (error) {
        console.error('❌ Erro ao salvar perfil:', error);
        showNotification('❌ Erro ao salvar perfil: ' + error.message, 'error');
    } finally {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    }
}

// SISTEMA DE MODO INVISÍVEL CORRIGIDO (NÃO INTERFERE NO SALVAMENTO)
async function loadInvisibleModeStatus() {
    try {
        console.log('👻 Carregando status do modo invisível...');
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_invisible, is_premium')
            .eq('id', currentUser.id)
            .single();
            
        if (error) {
            console.error('❌ Erro ao carregar modo invisível:', error);
            return;
        }
        
        const toggle = document.getElementById('invisibleModeToggle');
        const statusText = document.getElementById('invisibleStatus');
        const freeMessage = document.getElementById('invisibleFreeMessage');
        
        // Verificar se é premium
        const isPremium = await PremiumManager.checkPremiumStatus();
        
        if (!isPremium) {
            // Usuário free - mostrar mensagem e desabilitar toggle
            console.log('ℹ️ Usuário free - modo invisível não disponível');
            if (toggle) {
                toggle.disabled = true;
                toggle.checked = false;
            }
            if (statusText) statusText.textContent = 'Apenas Premium';
            if (freeMessage) freeMessage.style.display = 'flex';
            return;
        }
        
        // Usuário premium - configurar toggle
        const isInvisible = profile.is_invisible || false;
        console.log(`✅ Status do modo invisível: ${isInvisible ? 'ATIVO' : 'INATIVO'}`);
        
        if (toggle) {
            toggle.checked = isInvisible;
            toggle.disabled = false;
            
            // ✅ CORREÇÃO: Event listener simples
            toggle.onchange = function() {
                toggleInvisibleMode(this.checked);
            };
        }
        
        if (statusText) {
            statusText.textContent = isInvisible ? 'Ativado' : 'Desativado';
            statusText.className = isInvisible ? 'toggle-status active' : 'toggle-status inactive';
        }
        
        if (freeMessage) {
            freeMessage.style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Erro ao carregar modo invisível:', error);
    }
}

// ✅ CORREÇÃO DEFINITIVA: Função toggleInvisibleMode SEM conflitos
async function toggleInvisibleMode(isInvisible) {
    try {
        console.log(`👻 Alternando modo invisível para: ${isInvisible}`);
        
        const isPremium = await PremiumManager.checkPremiumStatus();
        if (!isPremium) {
            showNotification('❌ Apenas usuários Premium podem usar o modo invisível!', 'error');
            document.getElementById('invisibleModeToggle').checked = false;
            return;
        }
        
        // ✅ CORREÇÃO: Update DIRETO com updated_at para evitar conflitos
        const { error } = await supabase
            .from('profiles')
            .update({ 
                is_invisible: isInvisible,
                updated_at: new Date().toISOString() // ✅ MANTÉM SINCRONIZADO
            })
            .eq('id', currentUser.id);
            
        if (error) {
            console.error('❌ Erro ao atualizar modo invisível:', error);
            throw error;
        }
        
        // Atualizar interface
        const statusText = document.getElementById('invisibleStatus');
        if (statusText) {
            statusText.textContent = isInvisible ? 'Ativado' : 'Desativado';
            statusText.className = isInvisible ? 'toggle-status active' : 'toggle-status inactive';
        }
        
        console.log(`✅ Modo invisível ${isInvisible ? 'ativado' : 'desativado'}`);
        showNotification(`👻 Modo invisível ${isInvisible ? 'ativado' : 'desativado'}!`, 'success');
        
    } catch (error) {
        console.error('❌ Erro ao alterar modo invisível:', error);
        showNotification('❌ Erro ao alterar modo invisível', 'error');
        
        // Reverter toggle em caso de erro
        const toggle = document.getElementById('invisibleModeToggle');
        if (toggle) {
            toggle.checked = !isInvisible;
            console.log('🔄 Toggle revertido devido ao erro');
        }
    }
}

// ✅ CORREÇÃO: Sistema de status online otimizado
function startOnlineStatusUpdater() {
    // Atualizar imediatamente
    updateOnlineStatus();
    
    // Atualizar a cada 2 minutos (reduzido para performance)
    setInterval(updateOnlineStatus, 120000);
    
    // Atualizar quando a página fica visível
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            console.log('🔄 Página visível - atualizando status online');
            updateOnlineStatus();
        }
    });
    
    // Eventos de atividade do usuário
    ['click', 'mousemove', 'keypress'].forEach(event => {
        document.addEventListener(event, debounce(updateOnlineStatus, 30000), { passive: true });
    });
    
    console.log('🟢 Sistema de status online iniciado');
}

// ✅ CORREÇÃO: Debounce para evitar muitas atualizações
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ✅ CORREÇÃO: Update online status otimizado
async function updateOnlineStatus() {
    try {
        if (!currentUser) {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            currentUser = user;
        }

        const { error } = await supabase
            .from('profiles')
            .update({ 
                last_online_at: new Date().toISOString(),
                updated_at: new Date().toISOString() // ✅ Mantém sincronizado
            })
            .eq('id', currentUser.id);

        if (error) {
            console.error('❌ Erro ao atualizar status online:', error);
        } else {
            console.log('🟢 Status online atualizado');
        }
        
    } catch (error) {
        console.error('❌ Erro no sistema de status online:', error);
    }
}

// ✅ CORREÇÃO: Notificações melhoradas
function showNotification(message, type = 'info') {
    // Remover notificação existente
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    // Criar nova notificação
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    
    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: '💡'
    };
    
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-icon">${icons[type] || '💡'}</span>
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // Estilos
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'error' ? '#f56565' : 
                     type === 'success' ? '#48bb78' : 
                     type === 'warning' ? '#ed8936' : '#4299e1'};
        color: white;
        padding: 16px 20px;
        border-radius: 12px;
        box-shadow: 0 8px 25px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 350px;
        animation: slideInRight 0.3s ease;
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        font-size: 14px;
        line-height: 1.4;
    `;

    // Adicionar ao DOM
    document.body.appendChild(notification);

    // Auto-remover após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ✅ CORREÇÃO: Adicionar estilos CSS melhorados
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from { 
            transform: translateX(100%); 
            opacity: 0; 
        }
        to { 
            transform: translateX(0); 
            opacity: 1; 
        }
    }
    
    .notification {
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
    }
    
    .notification-icon {
        font-size: 16px;
        flex-shrink: 0;
    }
    
    .notification-message {
        flex: 1;
        font-weight: 500;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 20px;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
        transition: background-color 0.2s;
    }
    
    .notification-close:hover {
        background: rgba(255,255,255,0.2);
    }
`;
document.head.appendChild(style);

// ✅ CORREÇÃO: Contador de caracteres melhorado
function updateCharCount() {
    const textarea = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    
    if (textarea && charCount) {
        const count = textarea.value.length;
        const maxLength = 100;
        
        charCount.textContent = `${count}/${maxLength}`;
        
        // Cores baseadas na quantidade
        if (count === 0) {
            charCount.style.color = 'var(--text-light)';
        } else if (count < 50) {
            charCount.style.color = '#48bb78'; // Verde
        } else if (count < 80) {
            charCount.style.color = '#ed8936'; // Laranja
        } else if (count < 100) {
            charCount.style.color = '#f56565'; // Vermelho
        } else {
            charCount.style.color = '#e53e3e'; // Vermelho escuro
        }
        
        // Limitar caracteres se exceder
        if (count > maxLength) {
            textarea.value = textarea.value.substring(0, maxLength);
            updateCharCount(); // Atualizar novamente
            showNotification(`⚠️ Limite de ${maxLength} caracteres atingido!`, 'warning');
        }
    }
}

// ✅ CORREÇÃO: Logout com confirmação
async function logout() {
    try {
        const confirmLogout = confirm('Tem certeza que deseja sair?');
        if (!confirmLogout) return;
        
        showNotification('👋 Saindo...', 'info');
        
        // Atualizar último online antes de sair
        await supabase
            .from('profiles')
            .update({ 
                last_online_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
        
        // Fazer logout
        await supabase.auth.signOut();
        
        // Redirecionar
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1000);
        
    } catch (error) {
        console.error('❌ Erro ao fazer logout:', error);
        showNotification('❌ Erro ao sair', 'error');
    }
}

// ✅ CORREÇÃO: Debug functions
window.debugPremium = async function() {
    console.log('=== 🎯 DEBUG PREMIUM MANUAL ===');
    try {
        const result = await PremiumManager.checkPremiumStatus();
        console.log('🔍 Status Premium:', result);
        
        // Verificar perfil também
        const { data: profile } = await supabase
            .from('profiles')
            .select('is_premium, premium_expires_at, is_invisible')
            .eq('id', currentUser.id)
            .single();
            
        console.log('📊 Perfil:', profile);
        showNotification(`🔍 Debug: Premium=${result}`, 'info');
        
        return result;
    } catch (error) {
        console.error('❌ Erro no debug:', error);
        return false;
    }
};

// ✅ CORREÇÃO: Atualização automática quando volta de outras páginas
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        console.log('🔄 Página restaurada do cache - atualizando dados...');
        setTimeout(async () => {
            await PremiumManager.checkPremiumStatus();
            await updateProfileCompletion();
            await loadInvisibleModeStatus();
        }, 1000);
    }
});

// ✅ CORREÇÃO: Verificação quando a página fica visível
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('🔄 Página visível - sincronizando dados...');
        setTimeout(async () => {
            await PremiumManager.checkPremiumStatus();
            await updateOnlineStatus();
        }, 500);
    }
});

// ✅ INICIAR SISTEMAS
startOnlineStatusUpdater();

console.log('✅ painel.js carregado completamente - SISTEMA 100% CORRIGIDO E OTIMIZADO');

// ✅ CORREÇÃO FINAL: Garantir que todos os dados sejam carregados
setTimeout(() => {
    const emailInput = document.getElementById('email');
    if (emailInput && currentUser && !emailInput.value) {
        emailInput.value = currentUser.email || '';
        console.log('✅ Email preenchido via timeout de segurança');
    }
    
    // Verificar se precisa recarregar dados
    if (!document.querySelector('.premium-badge')) {
        updatePremiumStatus();
    }
}, 2000);

/// ==================== SISTEMA DE GALERIA PREMIUM CORRIGIDO ====================

let currentGalleryImages = [];
let selectedGalleryFiles = [];

// Inicializar galeria
async function initGallery() {
    await toggleGallerySection();
    await loadUserGallery();
}

// Mostrar/ocultar seção da galeria baseado no status premium
async function toggleGallerySection() {
    try {
        const isPremium = await PremiumManager.checkPremiumStatus();
        const galleryManager = document.getElementById('galleryManager');
        const galleryUpgradeCTA = document.getElementById('galleryUpgradeCTA');
        
        if (isPremium) {
            galleryManager.style.display = 'block';
            galleryUpgradeCTA.style.display = 'none';
            setupGalleryEvents();
        } else {
            galleryManager.style.display = 'none';
            galleryUpgradeCTA.style.display = 'flex';
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status da galeria:', error);
    }
}

// Configurar eventos da galeria
function setupGalleryEvents() {
    console.log('🔄 Configurando eventos da galeria...');
    
    const uploadBtn = document.getElementById('uploadGalleryBtn');
    const galleryUpload = document.getElementById('galleryUpload');
    
    if (uploadBtn && galleryUpload) {
        // Remover event listeners antigos
        const newUploadBtn = uploadBtn.cloneNode(true);
        const newGalleryUpload = galleryUpload.cloneNode(true);
        
        uploadBtn.replaceWith(newUploadBtn);
        galleryUpload.replaceWith(newGalleryUpload);
        
        newUploadBtn.addEventListener('click', function() {
            console.log('🎯 Clicou no botão de upload da galeria');
            newGalleryUpload.click();
        });
        
        newGalleryUpload.addEventListener('change', function(event) {
            console.log('📁 Arquivos selecionados:', event.target.files);
            handleGalleryUpload(event);
        });
        
        console.log('✅ Eventos da galeria configurados com sucesso');
    } else {
        console.error('❌ Elementos do upload não encontrados');
    }
}

// Manipular upload de imagens
async function handleGalleryUpload(event) {
    const files = Array.from(event.target.files);
    
    console.log('🔄 Iniciando upload de:', files.length, 'arquivos');
    
    if (files.length === 0) return;
    
    // Obter usuário atual
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        showNotification('❌ Usuário não autenticado', 'error');
        return;
    }
    
    // Verificar espaço disponível
    const storageUsed = await getStorageUsage();
    const availableSpace = 10 * 1024 * 1024 - storageUsed;
    
    let totalNewSize = 0;
    const validFiles = [];
    
    // Validar arquivos
    for (const file of files) {
        if (file.size > 10 * 1024 * 1024) {
            showNotification(`❌ A imagem ${file.name} excede 10MB`, 'error');
            continue;
        }
        
        if (!file.type.startsWith('image/')) {
            showNotification(`❌ ${file.name} não é uma imagem válida`, 'error');
            continue;
        }
        
        totalNewSize += file.size;
        validFiles.push(file);
    }
    
    if (validFiles.length === 0) return;
    
    if (totalNewSize > availableSpace) {
        showNotification('❌ Espaço insuficiente na galeria', 'error');
        return;
    }
    
    // Fazer upload das imagens
    await uploadGalleryImages(validFiles);
    
    // Limpar input
    event.target.value = '';
}

// Fazer upload das imagens para a galeria
async function uploadGalleryImages(files) {
    const uploadLoading = document.createElement('div');
    uploadLoading.className = 'upload-loading';
    uploadLoading.innerHTML = `
        <div class="spinner" style="width: 30px; height: 30px;"></div>
        <p>Enviando ${files.length} imagem(ns)...</p>
        <div class="upload-progress">
            <div class="upload-progress-bar" style="width: 0%"></div>
        </div>
    `;
    
    const galleryUpload = document.getElementById('galleryUpload');
    galleryUpload.parentNode.appendChild(uploadLoading);
    uploadLoading.style.display = 'block';
    
    try {
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const progress = ((i + 1) / files.length) * 100;
            uploadLoading.querySelector('.upload-progress-bar').style.width = `${progress}%`;
            
            await uploadGalleryImage(file);
        }
        
        showNotification(`✅ ${files.length} imagem(ns) adicionada(s) com sucesso!`, 'success');
        await loadUserGallery();
        await updateStorageDisplay();
        
    } catch (error) {
        console.error('❌ Erro ao fazer upload das imagens:', error);
        showNotification('❌ ' + error.message, 'error');
    } finally {
        uploadLoading.remove();
    }
}

// Upload de uma única imagem - ✅ CORREÇÃO DEFINITIVA DOS METADADOS
async function uploadGalleryImage(file) {
    try {
        console.log('🔄 Iniciando upload da imagem:', file.name, file.size, 'bytes');
        
        // Obter usuário atual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }

        console.log('👤 Usuário:', user.id);

        // Verificar status premium ANTES do upload
        const isPremium = await PremiumManager.checkPremiumStatus();
        console.log('⭐ Status Premium:', isPremium);
        
        if (!isPremium) {
            throw new Error('Apenas usuários premium podem fazer upload na galeria');
        }

        // Gerar nome único para o arquivo
        const fileExt = file.name.split('.').pop().toLowerCase();
        const fileName = `${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
        const filePath = `${user.id}/${fileName}`;
        
        console.log('📤 Fazendo upload para:', filePath);

        // 1. Primeiro fazer upload para o storage
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('gallery')
            .upload(filePath, file);

        if (uploadError) {
            console.error('❌ Erro no upload storage:', uploadError);
            
            if (uploadError.message?.includes('policy') || uploadError.message?.includes('row-level security')) {
                throw new Error('Permissão negada. Verifique se você é usuário premium.');
            }
            
            if (uploadError.message?.includes('bucket') || uploadError.message?.includes('not found')) {
                throw new Error('Erro no servidor. Bucket não encontrado.');
            }
            
            throw new Error('Erro ao fazer upload: ' + uploadError.message);
        }

        console.log('✅ Upload no storage realizado com sucesso');

        // 2. Obter URL pública
        const { data: urlData } = await supabase.storage
            .from('gallery')
            .getPublicUrl(filePath);

        console.log('🔗 URL pública gerada:', urlData.publicUrl);

        // 3. ✅ CORREÇÃO CRÍTICA: Salvar metadados no banco com tratamento de erro detalhado
        const galleryData = {
            user_id: user.id,
            image_name: fileName,
            image_url: filePath,
            file_size_bytes: file.size,
            mime_type: file.type,
            public_url: urlData.publicUrl,
            created_at: new Date().toISOString()
        };

        console.log('💾 Tentando salvar metadados:', galleryData);

        const { data: dbData, error: dbError } = await supabase
            .from('user_gallery')
            .insert([galleryData])
            .select();

        if (dbError) {
            console.error('❌ Erro detalhado ao salvar no banco:', dbError);
            console.error('❌ Código do erro:', dbError.code);
            console.error('❌ Mensagem do erro:', dbError.message);
            console.error('❌ Detalhes do erro:', dbError.details);
            console.error('❌ Hint do erro:', dbError.hint);
            
            // Reverter upload do storage se falhar no banco
            console.log('🔄 Revertendo upload do storage...');
            await supabase.storage.from('gallery').remove([filePath]);
            
            // Mensagens específicas baseadas no tipo de erro
            if (dbError.code === '42501') {
                throw new Error('Permissão negada para salvar metadados.');
            } else if (dbError.code === '23503') {
                throw new Error('Erro de referência. Tabela user_gallery não existe.');
            } else if (dbError.code === '42P01') {
                throw new Error('Tabela user_gallery não existe. Execute o SQL de criação.');
            } else {
                throw new Error('Erro ao salvar metadados: ' + dbError.message);
            }
        }

        console.log('✅ Metadados salvos no banco com sucesso:', dbData);
        return uploadData;

    } catch (error) {
        console.error('❌ Erro crítico no upload:', error);
        throw error;
    }
}

// Carregar galeria do usuário
async function loadUserGallery() {
    try {
        // Obter usuário atual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('❌ Usuário não autenticado');
            return;
        }

        const { data: images, error } = await supabase
            .from('user_gallery')
            .select('*')
            .eq('user_id', user.id)
            .order('created_at', { ascending: false });
        
        if (error) {
            console.error('❌ Erro ao carregar galeria:', error);
            // Se a tabela não existir, mostrar galeria vazia
            if (error.code === '42P01') {
                console.log('ℹ️ Tabela user_gallery não existe ainda');
                currentGalleryImages = [];
                displayGallery([]);
                return;
            }
            throw error;
        }
        
        currentGalleryImages = images || [];
        displayGallery(images || []);
        await updateStorageDisplay();
        
    } catch (error) {
        console.error('❌ Erro ao carregar galeria:', error);
        showNotification('❌ Erro ao carregar galeria', 'error');
    }
}

// Exibir galeria na tela
function displayGallery(images) {
    const galleryGrid = document.getElementById('galleryGrid');
    
    if (!images || images.length === 0) {
        galleryGrid.innerHTML = `
            <div class="empty-gallery">
                <i class="fas fa-images" style="font-size: 3rem; color: var(--lilas); margin-bottom: 1rem;"></i>
                <p>Sua galeria está vazia</p>
                <p style="font-size: 0.9rem; color: var(--text-light);">Adicione fotos para compartilhar momentos especiais</p>
            </div>
        `;
        return;
    }
    
    galleryGrid.innerHTML = images.map((image, index) => `
        <div class="gallery-item" data-index="${index}">
            <img src="" data-src="${image.image_url}" alt="Imagem da galeria" class="gallery-image" loading="lazy">
            <div class="gallery-actions">
                <button class="gallery-btn" onclick="deleteGalleryImage('${image.id}')" title="Excluir">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        </div>
    `).join('');
    
    // Carregar imagens lazy
    loadGalleryImagesLazy();
}

// Carregar imagens com lazy loading
function loadGalleryImagesLazy() {
    const images = document.querySelectorAll('.gallery-image[data-src]');
    
    const imageObserver = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const img = entry.target;
                loadGalleryImage(img);
                observer.unobserve(img);
            }
        });
    });
    
    images.forEach(img => imageObserver.observe(img));
}

// Carregar uma imagem específica
async function loadGalleryImage(imgElement) {
    const imageUrl = imgElement.getAttribute('data-src');
    
    try {
        if (!imageUrl) {
            console.error('❌ URL da imagem não encontrada');
            return;
        }
        
        const { data, error } = await supabase.storage
            .from('gallery')
            .getPublicUrl(imageUrl);
        
        if (error) {
            console.error('❌ Erro ao obter URL pública:', error);
            return;
        }
        
        if (data && data.publicUrl) {
            imgElement.src = data.publicUrl;
            imgElement.removeAttribute('data-src');
        }
    } catch (error) {
        console.error('❌ Erro ao carregar imagem:', error);
    }
}

// Excluir imagem da galeria
async function deleteGalleryImage(imageId) {
    if (!confirm('Tem certeza que deseja excluir esta imagem?')) return;
    
    try {
        // Obter usuário atual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            throw new Error('Usuário não autenticado');
        }

        // Buscar informações da imagem
        const { data: image, error: fetchError } = await supabase
            .from('user_gallery')
            .select('*')
            .eq('id', imageId)
            .eq('user_id', user.id)
            .single();
        
        if (fetchError) {
            if (fetchError.code === 'PGRST116') {
                showNotification('❌ Imagem não encontrada', 'error');
                return;
            }
            throw fetchError;
        }
        
        // Excluir do storage
        const { error: storageError } = await supabase.storage
            .from('gallery')
            .remove([image.image_url]);
        
        if (storageError) throw storageError;
        
        // Excluir do banco
        const { error: dbError } = await supabase
            .from('user_gallery')
            .delete()
            .eq('id', imageId)
            .eq('user_id', user.id);
        
        if (dbError) throw dbError;
        
        showNotification('✅ Imagem excluída com sucesso', 'success');
        await loadUserGallery();
        
    } catch (error) {
        console.error('❌ Erro ao excluir imagem:', error);
        showNotification('❌ Erro ao excluir imagem', 'error');
    }
}

// Obter uso de storage
async function getStorageUsage() {
    try {
        // Obter usuário atual
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return 0;

        const { data: usage, error } = await supabase
            .from('user_gallery')
            .select('file_size_bytes')
            .eq('user_id', user.id);
        
        if (error) {
            // Se a tabela não existir, retorna 0
            if (error.code === '42P01') return 0;
            throw error;
        }
        
        return usage.reduce((total, img) => total + (img.file_size_bytes || 0), 0);
    } catch (error) {
        console.error('❌ Erro ao calcular uso de storage:', error);
        return 0;
    }
}

// Atualizar display do storage
async function updateStorageDisplay() {
    const storageUsed = await getStorageUsage();
    const storageUsedMB = (storageUsed / (1024 * 1024)).toFixed(1);
    const storagePercentage = (storageUsed / (10 * 1024 * 1024)) * 100;
    
    document.getElementById('storageUsed').textContent = `${storageUsedMB}MB`;
    document.getElementById('storageFill').style.width = `${Math.min(storagePercentage, 100)}%`;

}

/// ==================== EXCLUSÃO DE CONTA ====================

// ==================== EXCLUSÃO DE CONTA - VERSÃO DEFINITIVA CORRIGIDA ====================

// Aguardar o DOM carregar completamente
document.addEventListener('DOMContentLoaded', function() {
    
    // Elementos do modal de exclusão
    const deleteAccountBtn = document.getElementById('deleteAccountBtn');
    const deleteAccountModal = document.getElementById('deleteAccountModal');
    const closeDeleteModal = document.getElementById('closeDeleteModal');
    const cancelDelete = document.getElementById('cancelDelete');
    const confirmDelete = document.getElementById('confirmDelete');
    const confirmationStep = document.getElementById('confirmationStep');
    const confirmPassword = document.getElementById('confirmPassword');
    const passwordFeedback = document.getElementById('passwordFeedback');

    // Estado do fluxo de exclusão
    let deleteFlowStep = 1; // 1 = aviso, 2 = confirmação com senha
    let isExcluding = false; // ✅ EVITAR CLICKS DUPLOS

    // Abrir modal de exclusão
    if (deleteAccountBtn && deleteAccountModal) {
        deleteAccountBtn.addEventListener('click', function() {
            if (isExcluding) return; // ✅ BLOQUEAR DURANTE EXCLUSÃO
            
            deleteFlowStep = 1;
            if (confirmationStep) confirmationStep.style.display = 'none';
            if (confirmDelete) {
                confirmDelete.disabled = false;
                confirmDelete.textContent = 'Sim, Excluir Minha Conta';
                confirmDelete.innerHTML = '<i class="fas fa-trash-alt"></i> Sim, Excluir Minha Conta';
            }
            if (confirmPassword) confirmPassword.value = '';
            if (passwordFeedback) {
                passwordFeedback.textContent = '';
                passwordFeedback.className = 'password-feedback';
            }
            deleteAccountModal.style.display = 'flex';
        });
    }

    // Fechar modal
    if (closeDeleteModal) {
        closeDeleteModal.addEventListener('click', closeDeleteModalFunc);
    }
    if (cancelDelete) {
        cancelDelete.addEventListener('click', closeDeleteModalFunc);
    }

    function closeDeleteModalFunc() {
        if (deleteAccountModal) {
            deleteAccountModal.style.display = 'none';
        }
    }

    // Primeira confirmação - mostrar campo de senha
    if (confirmDelete) {
        confirmDelete.addEventListener('click', function() {
            if (isExcluding) return; // ✅ BLOQUEAR DURANTE EXCLUSÃO
            
            if (deleteFlowStep === 1) {
                // Primeiro clique - mostrar campo de senha
                deleteFlowStep = 2;
                if (confirmationStep) {
                    confirmationStep.style.display = 'block';
                }
                if (confirmDelete) {
                    confirmDelete.disabled = true;
                    confirmDelete.textContent = 'Confirmar Exclusão';
                    confirmDelete.innerHTML = '<i class="fas fa-trash-alt"></i> Confirmar Exclusão';
                }
            } else {
                // Segundo clique - executar exclusão
                executeAccountDeletion();
            }
        });
    }

    // Validar senha em tempo real
    if (confirmPassword) {
        confirmPassword.addEventListener('input', async function() {
            if (isExcluding) return; // ✅ BLOQUEAR DURANTE EXCLUSÃO
            await validatePassword();
        });
    }

    // Função para validar senha
    async function validatePassword() {
        if (!confirmPassword || isExcluding) return false;
        
        const password = confirmPassword.value.trim();
        
        if (password.length === 0) {
            if (passwordFeedback) {
                passwordFeedback.textContent = '';
                passwordFeedback.className = 'password-feedback';
            }
            if (confirmDelete) confirmDelete.disabled = true;
            return false;
        }

        try {
            // Verificar se a senha está correta
            const { data, error } = await supabase.rpc('verify_user_password', {
                password: password
            });

            if (error) throw error;

            if (data) {
                if (passwordFeedback) {
                    passwordFeedback.textContent = '✓ Senha correta';
                    passwordFeedback.className = 'password-feedback success';
                }
                if (confirmDelete) {
                    confirmDelete.disabled = false;
                }
                return true;
            } else {
                if (passwordFeedback) {
                    passwordFeedback.textContent = '✗ Senha incorreta';
                    passwordFeedback.className = 'password-feedback error';
                }
                if (confirmDelete) {
                    confirmDelete.disabled = true;
                }
                return false;
            }
        } catch (error) {
            console.error('Erro ao verificar senha:', error);
            if (passwordFeedback) {
                passwordFeedback.textContent = 'Erro ao verificar senha';
                passwordFeedback.className = 'password-feedback error';
            }
            if (confirmDelete) confirmDelete.disabled = true;
            return false;
        }
    }

    // Permitir enviar com Enter
    if (confirmPassword) {
        confirmPassword.addEventListener('keypress', async function(e) {
            if (isExcluding) return; // ✅ BLOQUEAR DURANTE EXCLUSÃO
            
            if (e.key === 'Enter') {
                const isValid = await validatePassword();
                if (isValid && confirmDelete) {
                    executeAccountDeletion();
                }
            }
        });
    }

    // ✅✅✅ FUNÇÃO PRINCIPAL DE EXCLUSÃO - COMPLETAMENTE CORRIGIDA
    async function executeAccountDeletion() {
        if (!confirmPassword || !confirmDelete || isExcluding) {
            console.error('Elementos não encontrados ou exclusão em andamento');
            return;
        }

        const password = confirmPassword.value.trim();
        
        if (!password) {
            showNotification('Digite sua senha para confirmar', 'error');
            return;
        }

        // ✅ BLOQUEAR NOVAS TENTATIVAS
        isExcluding = true;
        
        // Mostrar loading
        confirmDelete.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Excluindo...';
        confirmDelete.disabled = true;

        try {
            console.log('🔄 Iniciando exclusão da conta...');
            
            // Chamar a função SQL que exclui tudo
            const { data, error } = await supabase.rpc('delete_user_completely', {
                user_password: password
            });

            if (error) throw error;

            if (data) {
                console.log('✅ Conta excluída com sucesso no banco');
                
                // ✅ 1. FECHAR MODAL PRIMEIRO (ANTES DE QUALQUER COISA)
                closeDeleteModalFunc();
                
                // ✅ 2. NOTIFICAÇÃO RÁPIDA
                showNotification('Conta excluída com sucesso', 'success');
                
                // ✅ 3. REDIRECIONAMENTO ULTRA-RÁPIDO E SEGURO
                setTimeout(() => {
                    console.log('🔄 Iniciando limpeza e redirecionamento...');
                    
                    // ✅ LIMPAR STORAGE SILENCIOSAMENTE
                    try {
                        localStorage.clear();
                        sessionStorage.clear();
                    } catch (e) {
                        console.log('⚠️ Erro ao limpar storage:', e);
                    }
                    
                    // ✅ LOGOUT SILENCIOSO (NÃO ESPERAR)
                    supabase.auth.signOut().catch(() => {});
                    
                    // ✅ REDIRECIONAMENTO FORÇADO - EVITA HISTORY
                    window.location.replace('index.html');
                    
                }, 800); // ✅ TEMPO OTIMIZADO: 800ms
                
            } else {
                throw new Error('Senha incorreta');
            }

        } catch (error) {
            console.error('❌ Erro ao excluir conta:', error);
            showNotification('Erro ao excluir conta: ' + error.message, 'error');
            
            // ✅ REABILITAR BOTÃO EM CASO DE ERRO
            if (confirmDelete) {
                confirmDelete.innerHTML = '<i class="fas fa-trash-alt"></i> Confirmar Exclusão';
                confirmDelete.disabled = false;
            }
            
            // ✅ LIBERAR PARA NOVAS TENTATIVAS
            isExcluding = false;
        }
    }

    // Fechar modal clicando fora
    if (deleteAccountModal) {
        deleteAccountModal.addEventListener('click', function(e) {
            if (isExcluding) return; // ✅ BLOQUEAR DURANTE EXCLUSÃO
            
            if (e.target === this) {
                closeDeleteModalFunc();
            }
        });
    }

    // ✅ PREVENÇÃO EXTRA: BLOQUEAR EVENTOS DURANTE REDIRECIONAMENTO
    window.addEventListener('beforeunload', function() {
        isExcluding = true; // ✅ BLOQUEAR TUDO DURANTE DESCARREGAMENTO
    });

});