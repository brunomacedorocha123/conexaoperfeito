// Configuração do Supabase
const SUPABASE_URL = 'https://gcukalndarlgydmgmmmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let selectedAvatarFile = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupEventListeners();
});

// VERIFICA SE USUÁRIO ESTÁ LOGADO
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    await initializeUserProfile();
    await loadUserData();
    await loadProfileData();
}

// INICIALIZA O PERFIL DO USUÁRIO SE NÃO EXISTIR
async function initializeUserProfile() {
    try {
        // Verifica se o perfil existe
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', currentUser.id)
            .single();

        // Se não existe, cria o perfil
        if (profileError && profileError.code === 'PGRST116') {
            console.log('Criando perfil para usuário...');
            
            const { error: createProfileError } = await supabase
                .from('profiles')
                .insert({
                    id: currentUser.id,
                    nickname: currentUser.email.split('@')[0],
                    full_name: '',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (createProfileError) throw createProfileError;

            // Cria também o user_details
            const { error: createDetailsError } = await supabase
                .from('user_details')
                .insert({
                    user_id: currentUser.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });

            if (createDetailsError) throw createDetailsError;
            
            console.log('Perfil criado com sucesso!');
        }
    } catch (error) {
        console.error('Erro ao inicializar perfil:', error);
        showNotification('❌ Erro ao inicializar perfil. Recarregue a página.', 'error');
    }
}

// CARREGA DADOS BÁSICOS DO USUÁRIO
async function loadUserData() {
    try {
        document.getElementById('email').value = currentUser.email;
        
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('nickname, avatar_url')
            .eq('id', currentUser.id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // Perfil não existe, vamos criar
                await initializeUserProfile();
                return;
            }
            throw error;
        }
        
        if (profile) {
            const nickname = profile.nickname || currentUser.email.split('@')[0];
            document.getElementById('userNickname').textContent = nickname;
            document.getElementById('mobileUserNickname').textContent = nickname;
            
            // Carrega avatar se existir
            if (profile.avatar_url) {
                await loadAvatar(profile.avatar_url);
            }
        }
    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

// CARREGA AVATAR DO USUÁRIO
async function loadAvatar(avatarUrl) {
    try {
        // Extrai o caminho do arquivo da URL
        const fileName = avatarUrl.split('/').pop();
        const fullPath = `${currentUser.id}/${fileName}`;
        
        const { data, error } = await supabase.storage
            .from('avatars')
            .createSignedUrl(fullPath, 60 * 60);

        if (error) throw error;
        
        if (data) {
            const avatarImg = document.querySelectorAll('.user-avatar-img');
            const previewImg = document.getElementById('avatarPreviewImg');
            const fallback = document.querySelectorAll('.user-avatar-fallback, .avatar-fallback');
            
            // Atualiza todas as imagens de avatar
            avatarImg.forEach(img => {
                img.src = data.signedUrl;
                img.style.display = 'block';
                img.onerror = function() {
                    this.style.display = 'none';
                    fallback.forEach(fb => fb.style.display = 'flex');
                };
            });
            
            if (previewImg) {
                previewImg.src = data.signedUrl;
                previewImg.style.display = 'block';
                previewImg.onerror = function() {
                    this.style.display = 'none';
                    document.getElementById('avatarFallback').style.display = 'flex';
                };
            }
            
            // Esconde fallbacks
            fallback.forEach(fb => fb.style.display = 'none');
        }
    } catch (error) {
        console.log('Erro ao carregar avatar:', error);
        // Mostra fallbacks em caso de erro
        document.querySelectorAll('.user-avatar-fallback, .avatar-fallback').forEach(fb => {
            fb.style.display = 'flex';
        });
    }
}

// CARREGA DADOS COMPLETOS DO PERFIL
async function loadProfileData() {
    try {
        // Busca dados do perfil
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profileError) {
            if (profileError.code === 'PGRST116') {
                await initializeUserProfile();
                return;
            }
            throw profileError;
        }

        // Busca detalhes do usuário
        const { data: userDetails, error: detailsError } = await supabase
            .from('user_details')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (detailsError && detailsError.code === 'PGRST116') {
            // user_details não existe, vamos criar
            const { error: createError } = await supabase
                .from('user_details')
                .insert({
                    user_id: currentUser.id,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                });
            
            if (createError) throw createError;
            return;
        } else if (detailsError) {
            throw detailsError;
        }

        // PREENCHE FORMULÁRIO COM DADOS EXISTENTES
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
            
            // Interesses - marca os checkboxes
            if (userDetails.interests && userDetails.interests.length > 0) {
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

// UPLOAD DE AVATAR PARA SUPABASE STORAGE
async function uploadAvatar(file) {
    try {
        // Verifica tamanho do arquivo (250KB = 256000 bytes)
        if (file.size > 256000) {
            showNotification('❌ A imagem deve ter no máximo 250KB!', 'error');
            return null;
        }

        // Verifica tipo do arquivo
        if (!file.type.startsWith('image/')) {
            showNotification('❌ Por favor, selecione uma imagem válida (JPG, PNG, GIF)!', 'error');
            return null;
        }

        // Gera nome único para o arquivo
        const fileExt = file.name.split('.').pop();
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        // Faz upload para o Supabase Storage
        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            if (error.message.includes('bucket')) {
                // Se o bucket não existir, tenta criar via API REST
                await initializeAvatarBucket();
                // Tenta upload novamente
                const { data: retryData, error: retryError } = await supabase.storage
                    .from('avatars')
                    .upload(filePath, file, {
                        cacheControl: '3600',
                        upsert: false
                    });
                
                if (retryError) throw retryError;
                return filePath;
            }
            throw error;
        }

        return filePath;

    } catch (error) {
        console.error('Erro no upload:', error);
        showNotification('❌ Erro ao fazer upload da imagem!', 'error');
        return null;
    }
}

// INICIALIZA O BUCKET DE AVATARS
async function initializeAvatarBucket() {
    try {
        // Tenta criar o bucket executando uma função no Supabase
        const { error } = await supabase.rpc('create_avatar_bucket');
        if (error) {
            console.log('Não foi possível criar o bucket automaticamente:', error);
        }
    } catch (error) {
        console.log('Método alternativo de criação de bucket:', error);
    }
}

// PREVIEW DA IMAGEM SELECIONADA
function handleAvatarSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    // Verifica tamanho
    if (file.size > 256000) {
        showNotification('❌ A imagem deve ter no máximo 250KB!', 'error');
        return;
    }

    selectedAvatarFile = file;

    // Cria preview local
    const reader = new FileReader();
    reader.onload = function(e) {
        const previewImg = document.getElementById('avatarPreviewImg');
        const fallback = document.getElementById('avatarFallback');
        const avatarImgs = document.querySelectorAll('.user-avatar-img');
        const headerFallbacks = document.querySelectorAll('.user-avatar-fallback');
        
        // Atualiza preview principal
        previewImg.src = e.target.result;
        previewImg.style.display = 'block';
        fallback.style.display = 'none';
        
        // Atualiza avatares no header
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
    reader.readAsDataURL(file);
}

// SALVA O PERFIL COMPLETO
async function saveProfile(event) {
    event.preventDefault();
    
    const saveButton = document.getElementById('saveButton');
    const originalText = saveButton.innerHTML;
    
    try {
        saveButton.innerHTML = '⏳ Salvando...';
        saveButton.disabled = true;

        // VERIFICA SE O PERFIL EXISTE ANTES DE SALVAR
        await ensureProfileExists();

        let avatarPath = null;

        // Faz upload da imagem se foi selecionada
        if (selectedAvatarFile) {
            showNotification('📤 Fazendo upload da imagem...', 'info');
            avatarPath = await uploadAvatar(selectedAvatarFile);
            if (!avatarPath) {
                saveButton.innerHTML = originalText;
                saveButton.disabled = false;
                return;
            }
        }

        // Coleta dados do formulário
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

        // Dados detalhados do usuário
        const userDetailsData = {
            user_id: currentUser.id, // GARANTE que o user_id está incluído
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

        // Coleta interesses selecionados
        const selectedInterests = [];
        document.querySelectorAll('input[name="interests"]:checked').forEach(checkbox => {
            selectedInterests.push(checkbox.value);
        });
        userDetailsData.interests = selectedInterests;

        // VALIDAÇÕES OBRIGATÓRIAS
        if (!profileData.nickname) {
            showNotification('❌ Informe um nickname!', 'error');
            return;
        }
        if (!profileData.birth_date) {
            showNotification('❌ Informe a data de nascimento!', 'error');
            return;
        }
        
        // Calcula idade a partir da data de nascimento
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

        // SALVA NO BANCO DE DADOS
        showNotification('💾 Salvando dados do perfil...', 'info');

        // Atualiza perfil principal - USA UPSERT PARA GARANTIR
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: currentUser.id,
                ...profileData
            }, {
                onConflict: 'id'
            });

        if (profileError) throw profileError;

        // Atualiza ou insere detalhes do usuário - USA UPSERT
        const { error: detailsError } = await supabase
            .from('user_details')
            .upsert({
                user_id: currentUser.id,
                ...userDetailsData
            }, {
                onConflict: 'user_id'
            });

        if (detailsError) throw detailsError;

        // ATUALIZA A INTERFACE
        document.getElementById('userNickname').textContent = profileData.nickname;
        document.getElementById('mobileUserNickname').textContent = profileData.nickname;
        
        // Reseta o arquivo selecionado
        selectedAvatarFile = null;
        document.getElementById('avatarInput').value = '';
        
        showNotification('✅ Perfil salvo com sucesso!', 'success');
        
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

// GARANTE QUE O PERFIL EXISTE ANTES DE SALVAR
async function ensureProfileExists() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('id')
            .eq('id', currentUser.id)
            .single();

        if (error && error.code === 'PGRST116') {
            // Perfil não existe, cria agora
            await initializeUserProfile();
        }
    } catch (error) {
        console.error('Erro ao verificar perfil:', error);
        throw error;
    }
}

// MOSTRA NOTIFICAÇÕES
function showNotification(message, type = 'info') {
    // Remove notificação anterior se existir
    const existingNotification = document.querySelector('.notification');
    if (existingNotification) {
        existingNotification.remove();
    }

    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
        <div class="notification-content">
            <span class="notification-message">${message}</span>
            <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
        </div>
    `;

    // Adiciona estilos dinamicamente
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: ${type === 'error' ? '#f56565' : type === 'success' ? '#48bb78' : '#4299e1'};
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 10px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 10000;
        max-width: 400px;
        animation: slideIn 0.3s ease;
    `;

    document.body.appendChild(notification);

    // Remove automaticamente após 5 segundos
    setTimeout(() => {
        if (notification.parentElement) {
            notification.remove();
        }
    }, 5000);
}

// ATUALIZA CONTADOR DE CARACTERES
function updateCharCount() {
    const textarea = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    if (textarea && charCount) {
        const count = textarea.value.length;
        charCount.textContent = count;
        
        // Altera cor se estiver perto do limite
        if (count > 90) {
            charCount.style.color = '#f56565';
        } else if (count > 80) {
            charCount.style.color = '#ed8936';
        } else {
            charCount.style.color = 'var(--text-light)';
        }
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

// CONFIGURA TODOS OS EVENT LISTENERS
function setupEventListeners() {
    // Form submission
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    
    // Logout buttons
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('mobileLogoutBtn').addEventListener('click', logout);
    
    // Avatar upload
    document.getElementById('avatarButton').addEventListener('click', () => {
        document.getElementById('avatarInput').click();
    });
    
    document.getElementById('avatarInput').addEventListener('change', handleAvatarSelect);
    
    // Character count
    document.getElementById('description').addEventListener('input', updateCharCount);
    
    // Menu mobile
    document.getElementById('hamburgerBtn').addEventListener('click', () => {
        document.getElementById('mobileMenu').style.display = 'flex';
    });
    
    document.getElementById('closeMobileMenu').addEventListener('click', () => {
        document.getElementById('mobileMenu').style.display = 'none';
    });
    
    // Fechar menu ao clicar em um link
    document.querySelectorAll('.mobile-nav a').forEach(link => {
        link.addEventListener('click', () => {
            document.getElementById('mobileMenu').style.display = 'none';
        });
    });
    
    // Fechar menu ao pressionar ESC
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            document.getElementById('mobileMenu').style.display = 'none';
        }
    });
}

// Adiciona estilos CSS para animações
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    .notification-content {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 1rem;
    }
    
    .notification-close {
        background: none;
        border: none;
        color: white;
        font-size: 1.5rem;
        cursor: pointer;
        padding: 0;
        width: 24px;
        height: 24px;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    
    .notification-close:hover {
        opacity: 0.8;
    }
`;
document.head.appendChild(style);