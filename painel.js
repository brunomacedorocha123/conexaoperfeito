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
            
            // Verificar na tabela de assinaturas
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
                // Garantir que o perfil está sincronizado
                await this.syncProfileWithSubscription(user.id, subscription);
                return true;
            }

            // Verificar se o perfil está correto
            const { data: profile, error: profileError } = await supabase
                .from('profiles')
                .select('is_premium, premium_expires_at')
                .eq('id', user.id)
                .single();
            
            if (profileError) return false;

            // Se o perfil diz que é premium mas não tem assinatura, corrigir
            if (profile.is_premium) {
                await this.fixPremiumStatus(user.id, false);
                return false;
            }
            
            return false;
            
        } catch (error) {
            console.error('Erro na verificação premium:', error);
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

            if (!error) {
                console.log('✅ Perfil sincronizado com assinatura');
            }
        } catch (error) {
            console.error('Erro na sincronização:', error);
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
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    setupEventListeners();
    await loadUserData();
    await loadProfileData();
    await updatePremiumStatus();
    await updateProfileCompletion();
    await updatePlanStatus();
    await loadInvisibleModeStatus();
}

// Configura eventos
function setupEventListeners() {
    // Form submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
    }

    // Avatar upload
    const avatarButton = document.getElementById('avatarButton');
    const avatarInput = document.getElementById('avatarInput');
    
    if (avatarButton && avatarInput) {
        avatarButton.addEventListener('click', function(e) {
            e.preventDefault();
            avatarInput.click();
        });
    }

    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarSelect);
    }

    // Máscaras para CPF, Telefone e CEP
    const cpfInput = document.getElementById('cpf');
    const phoneInput = document.getElementById('phone');
    const zipCodeInput = document.getElementById('zipCode');

    if (cpfInput) cpfInput.addEventListener('input', maskCPF);
    if (phoneInput) phoneInput.addEventListener('input', maskPhone);
    if (zipCodeInput) zipCodeInput.addEventListener('input', maskCEP);

    // Character count
    const description = document.getElementById('description');
    if (description) {
        description.addEventListener('input', updateCharCount);
    }

    // Menu mobile
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const closeMobileMenu = document.getElementById('closeMobileMenu');
    const mobileMenu = document.getElementById('mobileMenu');

    if (hamburgerBtn) {
        hamburgerBtn.addEventListener('click', function() {
            if (mobileMenu) mobileMenu.style.display = 'flex';
        });
    }

    if (closeMobileMenu) {
        closeMobileMenu.addEventListener('click', function() {
            if (mobileMenu) mobileMenu.style.display = 'none';
        });
    }

    // Logout buttons
    const logoutBtn = document.getElementById('logoutBtn');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    if (logoutBtn) logoutBtn.addEventListener('click', logout);
    if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logout);

    // Fechar menu ao clicar em links
    document.querySelectorAll('.mobile-nav a').forEach(link => {
        link.addEventListener('click', () => {
            if (mobileMenu) mobileMenu.style.display = 'none';
        });
    });

    // Fechar menu com ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && mobileMenu) {
            mobileMenu.style.display = 'none';
        }
    });
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
            planCard.classList.add('premium');
            planBadge.textContent = 'PREMIUM';
            planBadge.className = 'plan-badge premium';
            planDescription.textContent = 'Plano Premium com todos os benefícios ativos!';
            planActions.innerHTML = `
                <button class="btn btn-primary" onclick="window.location.href='mensagens.html'">
                    🚀 Ir para Mensagens
                </button>
            `;
        } else {
            planCard.classList.remove('premium');
            planBadge.textContent = 'GRATUITO';
            planBadge.className = 'plan-badge gratuito';
            planDescription.textContent = 'Plano gratuito com funcionalidades básicas';
            planActions.innerHTML = `
                <a href="princing.html" class="btn btn-primary">⭐ Fazer Upgrade</a>
            `;
        }
    } catch (error) {
        console.error('Erro ao atualizar status do plano:', error);
    }
}

// Atualizar status premium
async function updatePremiumStatus() {
    try {
        const isPremium = await PremiumManager.checkPremiumStatus();
        
        if (isPremium) {
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
        }
    } catch (error) {
        console.error('Erro ao verificar status premium:', error);
    }
}

// Atualizar progresso do perfil
async function updateProfileCompletion() {
    try {
        const { data: completion, error } = await supabase
            .rpc('calculate_profile_completion', { user_uuid: currentUser.id });
        
        if (error) return;

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
    } catch (error) {
        console.error('Erro ao atualizar progresso:', error);
    }
}

// Carrega dados básicos do usuário
async function loadUserData() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('nickname, avatar_url')
            .eq('id', currentUser.id)
            .single();
        
        if (error && error.code === 'PGRST116') {
            await createUserProfile();
            return;
        }
        
        if (profile) {
            const displayName = profile.nickname || currentUser.email.split('@')[0];
            
            document.getElementById('userNickname').textContent = displayName;
            document.getElementById('mobileUserNickname').textContent = displayName;
            
            if (profile.avatar_url) {
                await loadAvatar(profile.avatar_url);
            } else {
                showFallbackAvatars();
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
        showNotification('❌ Erro ao carregar dados do perfil', 'error');
    }
}

// Cria perfil do usuário se não existir
async function createUserProfile() {
    try {
        await supabase
            .from('profiles')
            .insert({
                id: currentUser.id,
                nickname: currentUser.email.split('@')[0],
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });

        await supabase
            .from('user_details')
            .insert({
                user_id: currentUser.id,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            });
        
        await loadUserData();
        
    } catch (error) {
        console.error('Erro ao criar perfil:', error);
        showNotification('❌ Erro ao criar perfil.', 'error');
    }
}

// Carrega avatar
async function loadAvatar(avatarPath) {
    try {
        const { data } = supabase.storage
            .from('avatars')
            .getPublicUrl(avatarPath);

        if (data && data.publicUrl) {
            updateAvatarImages(data.publicUrl);
        } else {
            showFallbackAvatars();
        }
    } catch (error) {
        showFallbackAvatars();
    }
}

// Atualiza imagens de avatar
function updateAvatarImages(imageUrl) {
    const avatarImgs = document.querySelectorAll('.user-avatar-img');
    const previewImg = document.getElementById('avatarPreviewImg');
    const fallbacks = document.querySelectorAll('.user-avatar-fallback, .avatar-fallback');
    
    avatarImgs.forEach(img => {
        img.src = imageUrl;
        img.style.display = 'block';
        img.onerror = () => {
            img.style.display = 'none';
        };
    });
    
    if (previewImg) {
        previewImg.src = imageUrl;
        previewImg.style.display = 'block';
        previewImg.onerror = () => {
            previewImg.style.display = 'none';
            document.getElementById('avatarFallback').style.display = 'flex';
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

// Carrega dados do perfil
async function loadProfileData() {
    try {
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

        const emailInput = document.getElementById('email');
        if (emailInput) {
            emailInput.value = currentUser.email || '';
        }

        if (profile) {
            document.getElementById('fullName').value = profile.full_name || '';
            document.getElementById('cpf').value = profile.cpf || '';
            document.getElementById('birthDate').value = profile.birth_date || '';
            document.getElementById('phone').value = profile.phone || '';
            document.getElementById('street').value = profile.street || '';
            document.getElementById('number').value = profile.number || '';
            document.getElementById('neighborhood').value = profile.neighborhood || '';
            document.getElementById('city').value = profile.city || '';
            document.getElementById('state').value = profile.state || '';
            document.getElementById('zipCode').value = profile.zip_code || '';
            document.getElementById('nickname').value = profile.nickname || '';
            
            if (profile.city && profile.state && (!userDetails || !userDetails.display_city)) {
                document.getElementById('displayCity').value = `${profile.city}, ${profile.state}`;
            }
        }

        if (userDetails) {
            if (userDetails.display_city) {
                document.getElementById('displayCity').value = userDetails.display_city;
            }
            document.getElementById('gender').value = userDetails.gender || '';
            document.getElementById('sexualOrientation').value = userDetails.sexual_orientation || '';
            document.getElementById('profession').value = userDetails.profession || '';
            document.getElementById('education').value = userDetails.education || '';
            document.getElementById('zodiac').value = userDetails.zodiac || '';
            document.getElementById('lookingFor').value = userDetails.looking_for || '';
            document.getElementById('description').value = userDetails.description || '';
            document.getElementById('religion').value = userDetails.religion || '';
            document.getElementById('drinking').value = userDetails.drinking || '';
            document.getElementById('smoking').value = userDetails.smoking || '';
            document.getElementById('exercise').value = userDetails.exercise || '';
            document.getElementById('exerciseDetails').value = userDetails.exercise_details || '';
            document.getElementById('hasPets').value = userDetails.has_pets || '';
            document.getElementById('petsDetails').value = userDetails.pets_details || '';
            
            if (userDetails.interests) {
                document.querySelectorAll('input[name="interests"]').forEach(checkbox => {
                    checkbox.checked = userDetails.interests.includes(checkbox.value);
                });
            }
        }

        updateCharCount();

    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        showNotification('❌ Erro ao carregar dados do perfil', 'error');
    }
}

// Handle avatar select
function handleAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (file.size > 256000) {
        showNotification('❌ A imagem deve ter no máximo 250KB!', 'error');
        return;
    }

    if (!file.type.startsWith('image/')) {
        showNotification('❌ Selecione uma imagem válida (JPG, PNG, GIF)!', 'error');
        return;
    }

    selectedAvatarFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        const previewImg = document.getElementById('avatarPreviewImg');
        const fallback = document.getElementById('avatarFallback');
        const avatarImgs = document.querySelectorAll('.user-avatar-img');
        const headerFallbacks = document.querySelectorAll('.user-avatar-fallback');
        
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        fallback.style.display = 'none';
        
        avatarImgs.forEach(img => {
            img.src = e.target.result;
            img.style.display = 'block';
        });
        
        headerFallbacks.forEach(fb => {
            fb.style.display = 'none';
        });
        
        showNotification('✅ Imagem selecionada! Clique em Salvar Perfil para confirmar.', 'success');
    };
    reader.readAsDataURL(file);
}

// Upload de avatar
async function uploadAvatar(file) {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_avatar.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            // Tentativa alternativa sem options
            const { data: retryData, error: retryError } = await supabase.storage
                .from('avatars')
                .upload(filePath, file);
                
            if (retryError) {
                throw new Error(`Falha no upload: ${retryError.message}`);
            }
            
            return filePath;
        }

        return filePath;

    } catch (error) {
        console.error('Erro no upload:', error);
        showNotification('⚠️ Imagem não pôde ser enviada, mas o perfil será salvo.', 'warning');
        return null;
    }
}

// SALVA PERFIL - FUNÇÃO PRINCIPAL CORRIGIDA
async function saveProfile(event) {
    event.preventDefault();
    
    const saveButton = document.getElementById('saveButton');
    const originalText = saveButton.innerHTML;
    
    try {
        saveButton.innerHTML = '⏳ Salvando...';
        saveButton.disabled = true;

        let avatarPath = null;

        // Upload da imagem se foi selecionada
        if (selectedAvatarFile) {
            showNotification('📤 Enviando imagem...', 'info');
            try {
                avatarPath = await uploadAvatar(selectedAvatarFile);
                if (avatarPath) {
                    showNotification('✅ Imagem enviada com sucesso!', 'success');
                }
            } catch (uploadError) {
                console.error('Upload falhou:', uploadError);
                showNotification('⚠️ Imagem não enviada, mas perfil será salvo', 'warning');
            }
        }

        // DADOS DO PERFIL
        const profileData = {
            full_name: document.getElementById('fullName').value.trim(),
            cpf: document.getElementById('cpf').value.replace(/\D/g, ''),
            birth_date: document.getElementById('birthDate').value,
            phone: document.getElementById('phone').value.replace(/\D/g, ''),
            street: document.getElementById('street').value.trim(),
            number: document.getElementById('number').value.trim(),
            neighborhood: document.getElementById('neighborhood').value.trim(),
            city: document.getElementById('city').value.trim(),
            state: document.getElementById('state').value,
            zip_code: document.getElementById('zipCode').value.replace(/\D/g, ''),
            nickname: document.getElementById('nickname').value.trim(),
            updated_at: new Date().toISOString()
        };

        // Adiciona avatar path se foi feito upload
        if (avatarPath) {
            profileData.avatar_url = avatarPath;
        }

        // DADOS DETALHADOS
        const userDetailsData = {
            display_city: document.getElementById('displayCity').value.trim(),
            gender: document.getElementById('gender').value,
            sexual_orientation: document.getElementById('sexualOrientation').value,
            profession: document.getElementById('profession').value.trim(),
            education: document.getElementById('education').value,
            zodiac: document.getElementById('zodiac').value,
            looking_for: document.getElementById('lookingFor').value,
            description: document.getElementById('description').value.trim(),
            religion: document.getElementById('religion').value,
            drinking: document.getElementById('drinking').value,
            smoking: document.getElementById('smoking').value,
            exercise: document.getElementById('exercise').value,
            exercise_details: document.getElementById('exerciseDetails').value.trim(),
            has_pets: document.getElementById('hasPets').value,
            pets_details: document.getElementById('petsDetails').value.trim(),
            updated_at: new Date().toISOString()
        };

        // Interesses
        const selectedInterests = [];
        document.querySelectorAll('input[name="interests"]:checked').forEach(checkbox => {
            selectedInterests.push(checkbox.value);
        });
        userDetailsData.interests = selectedInterests;

        // VALIDAÇÕES OBRIGATÓRIAS
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

        // Salva no banco
        showNotification('💾 Salvando dados do perfil...', 'info');

        // Atualiza perfil principal
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: currentUser.id,
                ...profileData
            }, { onConflict: 'id' });

        if (profileError) throw profileError;

        // Atualiza detalhes do usuário
        const { error: detailsError } = await supabase
            .from('user_details')
            .upsert({
                user_id: currentUser.id,
                ...userDetailsData
            }, { onConflict: 'user_id' });

        if (detailsError) throw detailsError;

        // Atualiza interface
        document.getElementById('userNickname').textContent = profileData.nickname;
        document.getElementById('mobileUserNickname').textContent = profileData.nickname;
        
        // Reseta o arquivo selecionado
        selectedAvatarFile = null;
        document.getElementById('avatarInput').value = '';
        
        showNotification('✅ Perfil salvo com sucesso!', 'success');
        
        // Atualiza progresso após salvar
        await updateProfileCompletion();
        await updatePremiumStatus();
        await updatePlanStatus();
        
        // Recarrega o avatar se foi atualizado
        if (avatarPath) {
            setTimeout(() => {
                loadAvatar(avatarPath);
            }, 1000);
        }

    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        showNotification('❌ Erro ao salvar perfil: ' + error.message, 'error');
    } finally {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
    }
}

// Sistema de Modo Invisível (SIMPLIFICADO E FUNCIONAL)
async function loadInvisibleModeStatus() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('is_invisible, is_premium')
            .eq('id', currentUser.id)
            .single();
            
        if (error) return;
        
        const isPremium = await PremiumManager.checkPremiumStatus();
        const toggle = document.getElementById('invisibleModeToggle');
        const statusText = document.getElementById('invisibleStatus');
        const freeMessage = document.getElementById('invisibleFreeMessage');
        
        if (!isPremium) {
            if (toggle) toggle.disabled = true;
            if (statusText) statusText.textContent = 'Apenas Premium';
            if (freeMessage) freeMessage.style.display = 'flex';
            return;
        }
        
        const isInvisible = profile.is_invisible || false;
        
        if (toggle) {
            toggle.checked = isInvisible;
            toggle.disabled = false;
            
            toggle.addEventListener('change', function() {
                toggleInvisibleMode(this.checked);
            });
        }
        
        if (statusText) {
            statusText.textContent = isInvisible ? 'Ativado' : 'Desativado';
            statusText.className = isInvisible ? 'toggle-status active' : 'toggle-status inactive';
        }
        
        if (freeMessage) {
            freeMessage.style.display = 'none';
        }
        
    } catch (error) {
        console.error('Erro ao carregar modo invisível:', error);
    }
}

// Alternar modo invisível
async function toggleInvisibleMode(isInvisible) {
    try {
        const isPremium = await PremiumManager.checkPremiumStatus();
        if (!isPremium) {
            showNotification('❌ Apenas usuários Premium podem usar o modo invisível!', 'error');
            document.getElementById('invisibleModeToggle').checked = false;
            return;
        }
        
        const { error } = await supabase
            .from('profiles')
            .update({ 
                is_invisible: isInvisible,
                updated_at: new Date().toISOString()
            })
            .eq('id', currentUser.id);
            
        if (error) throw error;
        
        const statusText = document.getElementById('invisibleStatus');
        if (statusText) {
            statusText.textContent = isInvisible ? 'Ativado' : 'Desativado';
            statusText.className = isInvisible ? 'toggle-status active' : 'toggle-status inactive';
        }
        
        showNotification(`👻 Modo invisível ${isInvisible ? 'ativado' : 'desativado'}!`, 'success');
        
    } catch (error) {
        console.error('Erro ao alterar modo invisível:', error);
        showNotification('❌ Erro ao alterar modo invisível', 'error');
        document.getElementById('invisibleModeToggle').checked = !isInvisible;
    }
}

// Funções auxiliares
function updateCharCount() {
    const textarea = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = count;
        charCount.style.color = count > 90 ? '#f56565' : count > 80 ? '#ed8936' : 'var(--text-light)';
    }
}

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

// Continuação do painel.js

// Sistema de Status Online
function startOnlineStatusUpdater() {
    // Atualizar status online periodicamente
    updateOnlineStatus();
    setInterval(updateOnlineStatus, 60000);
    
    // Atualizar quando a página ganha foco
    document.addEventListener('visibilitychange', function() {
        if (!document.hidden) {
            updateOnlineStatus();
        }
    });
    
    // Atualizar em interações do usuário
    ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
        document.addEventListener(event, updateOnlineStatus, { passive: true });
    });
    
    console.log('🟢 Sistema de status online iniciado');
}

// Atualizar status online do usuário
async function updateOnlineStatus() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Atualizar último seen no banco
        const { error } = await supabase
            .from('profiles')
            .update({ 
                last_online_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            })
            .eq('id', user.id);

        if (error) {
            console.error('Erro ao atualizar status online:', error);
        }
        
    } catch (error) {
        console.error('Erro no sistema de status online:', error);
    }
}

// Verificar se usuário está online (considerando modo invisível)
function isUserOnline(userProfile, currentUserId) {
    if (!userProfile.last_online_at) return false;
    
    const lastOnline = new Date(userProfile.last_online_at);
    const now = new Date();
    const minutesDiff = (now - lastOnline) / (1000 * 60);
    
    // Considera online se esteve ativo nos últimos 5 minutos
    const isActuallyOnline = minutesDiff <= 5;
    
    // Se é o próprio usuário, sempre mostra online
    if (userProfile.id === currentUserId) return true;
    
    // Se o usuário está invisível, mostra como offline para outros
    if (userProfile.is_invisible && userProfile.id !== currentUserId) {
        return false;
    }
    
    return isActuallyOnline;
}

// Sincronização entre abas (versão simplificada)
function setupInvisibleModeSyncListener() {
    try {
        // Escutar mudanças no localStorage (para abas diferentes)
        window.addEventListener('storage', function(event) {
            if (event.key === 'invisibleModeChanged') {
                const isInvisible = localStorage.getItem('invisibleModeStatus') === 'true';
                handleInvisibleModeChange(isInvisible);
            }
        });
        
        console.log('👂 Ouvinte de sincronização configurado');
        
    } catch (error) {
        console.error('Erro ao configurar sincronização:', error);
    }
}

// Processar mudança do modo invisível
function handleInvisibleModeChange(isInvisible) {
    try {
        console.log(`🔄 Processando mudança do modo invisível para: ${isInvisible}`);
        
        // Atualizar toggle visualmente
        const toggle = document.getElementById('invisibleModeToggle');
        if (toggle && toggle.checked !== isInvisible) {
            toggle.checked = isInvisible;
        }
        
        // Atualizar texto de status
        const statusText = document.getElementById('invisibleStatus');
        if (statusText) {
            statusText.textContent = isInvisible ? 'Ativado' : 'Desativado';
            statusText.className = isInvisible ? 'toggle-status active' : 'toggle-status inactive';
        }
        
        console.log(`✅ Interface atualizada para modo invisível: ${isInvisible}`);
        
    } catch (error) {
        console.error('Erro ao processar mudança do modo invisível:', error);
    }
}

// Sincronizar modo invisível com outras abas
function syncInvisibleModeToOtherTabs(isInvisible) {
    try {
        // Atualizar localStorage como gatilho
        localStorage.setItem('invisibleModeChanged', Date.now().toString());
        localStorage.setItem('invisibleModeStatus', isInvisible.toString());
        
        console.log(`🔄 Modo invisível sincronizado para outras abas: ${isInvisible}`);
        
    } catch (error) {
        console.error('Erro ao sincronizar modo invisível:', error);
    }
}

// Atualizar função toggleInvisibleMode para incluir sincronização
async function toggleInvisibleMode(isInvisible) {
    try {
        const isPremium = await PremiumManager.checkPremiumStatus();
        if (!isPremium) {
            showNotification('❌ Apenas usuários Premium podem usar o modo invisível!', 'error');
            document.getElementById('invisibleModeToggle').checked = false;
            return;
        }
        
        const { error } = await supabase
            .from('profiles')
            .update({ 
                is_invisible: isInvisible,
                last_online_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
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
        
        // Sincronizar com outras abas
        syncInvisibleModeToOtherTabs(isInvisible);
        
        // Atualizar status online também
        updateOnlineStatus();
        
    } catch (error) {
        console.error('Erro ao alterar modo invisível:', error);
        showNotification('❌ Erro ao alterar modo invisível', 'error');
        
        // Reverter toggle em caso de erro
        document.getElementById('invisibleModeToggle').checked = !isInvisible;
    }
}

// Funções de debug e utilitárias
window.debugPremium = async function() {
    console.log('=== 🎯 DEBUG PREMIUM MANUAL ===');
    const result = await PremiumManager.checkPremiumStatus();
    console.log('🔍 Resultado:', result);
    return result;
};

// Verificação automática quando volta de outras páginas
window.addEventListener('pageshow', function(event) {
    if (event.persisted) {
        console.log('🔄 Página restaurada do cache - verificando premium...');
        setTimeout(() => {
            PremiumManager.checkPremiumStatus();
        }, 1000);
    }
});

// Verificação quando a página fica visível
document.addEventListener('visibilitychange', function() {
    if (!document.hidden) {
        console.log('🔄 Página visível - verificando premium...');
        setTimeout(() => {
            PremiumManager.checkPremiumStatus();
        }, 500);
    }
});

// Inicializar sistemas quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    // Iniciar sistema de status online
    startOnlineStatusUpdater();
    
    // Configurar sincronização entre abas
    setupInvisibleModeSyncListener();
});

// Exportar funções globais para debug
window.PremiumManager = PremiumManager;
window.supabaseClient = supabase;

console.log('✅ painel.js carregado completamente');