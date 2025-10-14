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

// CONTINUA NO PRÓXIMO MENSAGEM (CÓDIGO MUITO GRANDE)
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

// ✅ CORREÇÃO CRÍTICA: Função toggleInvisibleMode SEM conflitos
async function toggleInvisibleMode(isInvisible) {
    try {
        console.log(`👻 Alternando modo invisível para: ${isInvisible}`);
        
        // Verificar se é premium
        const isPremium = await PremiumManager.checkPremiumStatus();
        if (!isPremium) {
            showNotification('❌ Apenas usuários Premium podem usar o modo invisível!', 'error');
            document.getElementById('invisibleModeToggle').checked = false;
            return;
        }
        
        // ✅ CORREÇÃO: Atualiza APENAS o campo is_invisible (SEM updated_at)
        const { error } = await supabase
            .from('profiles')
            .update({ 
                is_invisible: isInvisible
                // ❌ REMOVIDO: updated_at que causava conflito com salvamento
            })
            .eq('id', currentUser.id);
            
        if (error) throw error;
        
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
        if (toggle) toggle.checked = !isInvisible;
    }
}

// NOTIFICAÇÕES
function showNotification(message, type = 'info') {
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close">×</button>
        </div>
    `;

    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'error' ? '#f56565' : type === 'success' ? '#48bb78' : type === 'warning' ? '#ed8936' : '#4299e1'};
        color: white;
        padding: 12px 20px;
        border-radius: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 300px;
        animation: slideIn 0.3s ease;
    `;

    notification.querySelector('.notification-close').onclick = () => notification.remove();
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 5000);
}

// CONTADOR DE CARACTERES
function updateCharCount() {
    const textarea = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = count;
        charCount.style.color = count > 90 ? '#f56565' : count > 80 ? '#ed8936' : 'var(--text-light)';
    }
}

// LOGOUT
async function logout() {
    try {
        await supabase.auth.signOut();
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
    }
}

// Adiciona estilos CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    
    .notification {
        font-family: Arial, sans-serif;
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 18px;
        cursor: pointer;
        margin-left: 10px;
    }
`;
document.head.appendChild(style);

// SISTEMA DE STATUS ONLINE SIMPLES
function startOnlineStatusUpdater() {
    updateOnlineStatus();
    setInterval(updateOnlineStatus, 60000);
    
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            updateOnlineStatus();
        }
    });
    
    ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
        document.addEventListener(event, updateOnlineStatus, { passive: true });
    });
    
    console.log('🟢 Sistema de status online iniciado');
}

async function updateOnlineStatus() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { error } = await supabase
            .from('profiles')
            .update({ 
                last_online_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (error) {
            console.error('Erro ao atualizar status online:', error);
        }
        
    } catch (error) {
        console.error('Erro no sistema de status online:', error);
    }
}

// FUNÇÃO DE DEBUG PARA TESTAR MANUALMENTE
window.debugPremium = async function() {
    console.log('=== 🎯 DEBUG PREMIUM MANUAL ===');
    const result = await PremiumManager.checkPremiumStatus();
    console.log('🔍 Resultado:', result);
    return result;
};

// ATUALIZAÇÃO AUTOMÁTICA QUANDO VOLTA DE OUTRAS PÁGINAS
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        console.log('🔄 Página restaurada do cache - verificando premium...');
        setTimeout(() => {
            PremiumManager.checkPremiumStatus();
        }, 1000);
    }
});

// VERIFICAÇÃO QUANDO A PÁGINA FICA VISÍVEL
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('🔄 Página visível - verificando premium...');
        setTimeout(() => {
            PremiumManager.checkPremiumStatus();
        }, 500);
    }
});

// INICIAR SISTEMA DE STATUS ONLINE
startOnlineStatusUpdater();

console.log('✅ painel.js carregado completamente - SISTEMA 100% CORRIGIDO');

// ✅ CORREÇÃO FINAL: Garantir que o email seja preenchido mesmo se houver erro
setTimeout(() => {
    const emailInput = document.getElementById('email');
    if (emailInput && currentUser && !emailInput.value) {
        emailInput.value = currentUser.email || '';
        console.log('✅ Email preenchido via timeout de segurança');
    }
}, 2000);