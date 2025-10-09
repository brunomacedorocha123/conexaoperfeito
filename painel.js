// Configuração do Supabase
const SUPABASE_URL = 'https://gcukalndarlgydmgmmmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let selectedAvatarFile = null;

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando painel...');
    checkAuth();
});

// VERIFICA SE USUÁRIO ESTÁ LOGADO
async function checkAuth() {
    console.log('🔐 Verificando autenticação...');
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log('❌ Usuário não autenticado, redirecionando...');
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    console.log('✅ Usuário autenticado:', user.email);
    setupEventListeners();
    await loadUserData();
    await loadProfileData();
}

// CONFIGURA EVENTOS - CORRIGIDO
function setupEventListeners() {
    console.log('🎯 Configurando event listeners...');
    
    // Form submission
    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
        console.log('✅ Formulário configurado');
    }

    // Avatar upload - CORREÇÃO PRINCIPAL
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

    console.log('🎯 Todos os event listeners configurados');
}

// CARREGA DADOS BÁSICOS DO USUÁRIO
async function loadUserData() {
    try {
        console.log('👤 Carregando dados do usuário...');
        document.getElementById('email').value = currentUser.email;
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('nickname, avatar_url')
            .eq('id', currentUser.id)
            .single();
        
        if (error && error.code === 'PGRST116') {
            console.log('📝 Criando perfil novo...');
            await createUserProfile();
            return;
        }
        
        if (profile) {
            const nickname = profile.nickname || currentUser.email.split('@')[0];
            document.getElementById('userNickname').textContent = nickname;
            document.getElementById('mobileUserNickname').textContent = nickname;
            
            // Carrega avatar se existir
            if (profile.avatar_url) {
                console.log('🖼️ Carregando avatar existente...');
                await loadAvatar(profile.avatar_url);
            } else {
                console.log('❌ Nenhum avatar encontrado');
                showFallbackAvatars();
            }
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
        showNotification('❌ Erro ao carregar dados do perfil', 'error');
    }
}

// CRIA PERFIL DO USUÁRIO SE NÃO EXISTIR
async function createUserProfile() {
    try {
        const { error: profileError } = await supabase
            .from('profiles')
            .insert({
                id: currentUser.id,
                nickname: currentUser.email.split('@')[0],
                full_name: '',
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
        
        // Recarrega os dados
        await loadUserData();
        
    } catch (error) {
        console.error('❌ Erro ao criar perfil:', error);
        showNotification('❌ Erro ao criar perfil.', 'error');
    }
}

// CARREGA AVATAR
async function loadAvatar(avatarPath) {
    try {
        console.log('🔄 Carregando avatar:', avatarPath);
        
        // Pega URL pública direto do storage
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

// ATUALIZA IMAGENS DE AVATAR
function updateAvatarImages(imageUrl) {
    const avatarImgs = document.querySelectorAll('.user-avatar-img');
    const previewImg = document.getElementById('avatarPreviewImg');
    const fallbacks = document.querySelectorAll('.user-avatar-fallback, .avatar-fallback');
    
    console.log('✅ Atualizando avatares com URL:', imageUrl);
    
    // Atualiza todas as imagens
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
            document.getElementById('avatarFallback').style.display = 'flex';
        };
    }
    
    // Esconde fallbacks
    fallbacks.forEach(fb => {
        fb.style.display = 'none';
    });
}

// MOSTRA FALLBACK
function showFallbackAvatars() {
    document.querySelectorAll('.user-avatar-fallback, .avatar-fallback').forEach(fb => {
        fb.style.display = 'flex';
    });
}

// CARREGA DADOS DO PERFIL
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
            return;
        }

        // PREENCHE FORMULÁRIO
        if (profile) {
            document.getElementById('fullName').value = profile.full_name || '';
            document.getElementById('nickname').value = profile.nickname || '';
            document.getElementById('birthDate').value = profile.birth_date || '';
        }

        if (userDetails) {
            document.getElementById('phone').value = userDetails.phone || '';
            document.getElementById('location').value = userDetails.address || '';
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
            
            // Interesses
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

// HANDLE AVATAR SELECT - CORRIGIDO
function handleAvatarSelect(event) {
    console.log('📁 Arquivo selecionado:', event.target.files[0]);
    const file = event.target.files[0];
    if (!file) {
        console.log('❌ Nenhum arquivo selecionado');
        return;
    }

    // Verifica tamanho (250KB = 256000 bytes)
    if (file.size > 256000) {
        showNotification('❌ A imagem deve ter no máximo 250KB!', 'error');
        return;
    }

    // Verifica tipo
    if (!file.type.startsWith('image/')) {
        showNotification('❌ Selecione uma imagem válida (JPG, PNG, GIF)!', 'error');
        return;
    }

    selectedAvatarFile = file;
    console.log('✅ Arquivo validado:', file.name, file.size, 'bytes');

    // Cria preview local
    const reader = new FileReader();
    reader.onload = function(e) {
        console.log('🖼️ Criando preview da imagem...');
        
        // Atualiza preview
        const previewImg = document.getElementById('avatarPreviewImg');
        const fallback = document.getElementById('avatarFallback');
        const avatarImgs = document.querySelectorAll('.user-avatar-img');
        const headerFallbacks = document.querySelectorAll('.user-avatar-fallback');
        
        // Atualiza preview principal
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        fallback.style.display = 'none';
        
        // Atualiza avatares no header (apenas preview local)
        avatarImgs.forEach(img => {
            img.src = e.target.result;
            img.style.display = 'block';
        });
        
        // Esconde fallbacks do header
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

// UPLOAD DE AVATAR
async function uploadAvatar(file) {
    try {
        console.log('📤 Iniciando upload do avatar...');
        
        // Nome do arquivo - usa nome fixo para sobrescrever
        const fileExt = file.name.split('.').pop();
        const fileName = `avatar.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        console.log('📁 Fazendo upload para:', filePath);

        // Faz upload COM UPSERT
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (error) {
            console.error('❌ Erro no upload:', error);
            throw error;
        }

        console.log('✅ Upload realizado com sucesso:', data);
        return filePath;

    } catch (error) {
        console.error('❌ Erro completo no upload:', error);
        showNotification('❌ Erro ao fazer upload da imagem: ' + error.message, 'error');
        return null;
    }
}

// SALVA PERFIL
async function saveProfile(event) {
    event.preventDefault();
    console.log('💾 Salvando perfil...');
    
    const saveButton = document.getElementById('saveButton');
    const originalText = saveButton.innerHTML;
    
    try {
        saveButton.innerHTML = '⏳ Salvando...';
        saveButton.disabled = true;

        let avatarPath = null;

        // Upload da imagem se foi selecionada
        if (selectedAvatarFile) {
            console.log('📤 Fazendo upload da imagem...');
            showNotification('📤 Enviando imagem...', 'info');
            avatarPath = await uploadAvatar(selectedAvatarFile);
            if (!avatarPath) {
                saveButton.innerHTML = originalText;
                saveButton.disabled = false;
                return;
            }
        }

        // Dados do perfil
        const profileData = {
            full_name: document.getElementById('fullName').value.trim(),
            nickname: document.getElementById('nickname').value.trim(),
            birth_date: document.getElementById('birthDate').value,
            updated_at: new Date().toISOString()
        };

        // Adiciona avatar path se foi feito upload
        if (avatarPath) {
            profileData.avatar_url = avatarPath;
        }

        // Dados detalhados
        const userDetailsData = {
            phone: document.getElementById('phone').value.trim(),
            address: document.getElementById('location').value.trim(),
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

        // Validações obrigatórias
        if (!profileData.nickname) {
            showNotification('❌ Informe um nickname!', 'error');
            return;
        }
        if (!profileData.birth_date) {
            showNotification('❌ Informe a data de nascimento!', 'error');
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
            return;
        }
        
        if (!userDetailsData.gender) {
            showNotification('❌ Informe o gênero!', 'error');
            return;
        }
        if (!userDetailsData.looking_for) {
            showNotification('❌ Informe o que você procura!', 'error');
            return;
        }

        // Salva no banco
        console.log('💾 Salvando no banco de dados...');
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
        
        console.log('✅ Perfil salvo com sucesso!');
        showNotification('✅ Perfil salvo com sucesso!', 'success');
        
        // Recarrega o avatar se foi atualizado
        if (avatarPath) {
            setTimeout(() => {
                loadAvatar(avatarPath);
            }, 1000);
        }

    } catch (error) {
        console.error('❌ Erro ao salvar perfil:', error);
        showNotification('❌ Erro ao salvar perfil: ' + error.message, 'error');
    } finally {
        saveButton.innerHTML = originalText;
        saveButton.disabled = false;
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
`;
document.head.appendChild(style);