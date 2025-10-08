// Configuração do Supabase
const SUPABASE_URL = 'https://gcukalndarlgydmgmmmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Estado da aplicação
let currentUser = null;
let avatarFile = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
    setupMobileMenu();
    setupEventListeners();
});

// ==================== MENU MOBILE ====================
function setupMobileMenu() {
    const hamburgerBtn = document.getElementById('hamburgerBtn');
    const mobileMenu = document.getElementById('mobileMenu');
    const closeMobileMenu = document.getElementById('closeMobileMenu');
    const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');

    hamburgerBtn.addEventListener('click', () => {
        mobileMenu.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    });

    closeMobileMenu.addEventListener('click', () => {
        mobileMenu.style.display = 'none';
        document.body.style.overflow = 'auto';
    });

    mobileLogoutBtn.addEventListener('click', logout);

    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            mobileMenu.style.display = 'none';
            document.body.style.overflow = 'auto';
        });
    });

    function checkScreenSize() {
        if (window.innerWidth <= 768) {
            const userMenu = document.querySelector('.user-menu');
            if (userMenu) userMenu.style.display = 'none';
            hamburgerBtn.style.display = 'flex';
        } else {
            const userMenu = document.querySelector('.user-menu');
            if (userMenu) userMenu.style.display = 'flex';
            hamburgerBtn.style.display = 'none';
            mobileMenu.style.display = 'none';
            document.body.style.overflow = 'auto';
        }
    }

    window.addEventListener('resize', checkScreenSize);
    checkScreenSize();
}

// ==================== AUTENTICAÇÃO ====================
async function checkAuth() {
    try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) throw error;
        
        if (!user) {
            window.location.href = 'login.html';
            return;
        }
        
        currentUser = user;
        await loadUserData();
        await loadProfileData();
        
    } catch (error) {
        console.error('Erro na autenticação:', error);
        window.location.href = 'login.html';
    }
}

// ==================== DADOS DO USUÁRIO ====================
async function loadUserData() {
    try {
        const { data: { user } } = await supabase.auth.getUser();
        
        // PREENCHE E-MAIL AUTOMATICAMENTE
        const emailField = document.getElementById('email');
        if (emailField && user.email) {
            emailField.value = user.email;
        }
        
        let displayName = 'Usuário';
        
        if (user.user_metadata && user.user_metadata.nickname) {
            displayName = user.user_metadata.nickname;
        } else if (user.user_metadata && user.user_metadata.full_name) {
            displayName = user.user_metadata.full_name;
        } else if (user.email) {
            displayName = user.email.split('@')[0];
        }

        const userNickname = document.getElementById('userNickname');
        const mobileUserNickname = document.getElementById('mobileUserNickname');
        
        if (userNickname) userNickname.textContent = displayName;
        if (mobileUserNickname) mobileUserNickname.textContent = displayName;
        
        await loadCurrentUserAvatar();

    } catch (error) {
        console.error('Erro ao carregar dados do usuário:', error);
    }
}

async function loadCurrentUserAvatar() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('avatar_url, nickname')
            .eq('id', currentUser.id)
            .single();

        if (error || !profile) {
            console.log('Perfil não encontrado ou erro:', error);
            return;
        }

        const avatarElements = [
            document.getElementById('userAvatar'),
            document.getElementById('mobileUserAvatar'),
            document.getElementById('avatarPreview')
        ];

        for (const avatarElement of avatarElements) {
            if (!avatarElement) continue;
            
            const userAvatarFallback = avatarElement.querySelector('.user-avatar-fallback') || 
                                      avatarElement.querySelector('.avatar-fallback');
            const userAvatarImg = avatarElement.querySelector('.user-avatar-img') || 
                                 avatarElement.querySelector('img');
            
            if (!userAvatarFallback || !userAvatarImg) continue;

            userAvatarImg.style.display = 'none';
            userAvatarFallback.style.display = 'flex';
            
            if (profile.avatar_url) {
                const photoUrl = await loadUserPhoto(profile.avatar_url);
                if (photoUrl) {
                    userAvatarImg.src = photoUrl;
                    userAvatarImg.style.display = 'block';
                    userAvatarFallback.style.display = 'none';
                    avatarElement.style.backgroundImage = `url(${photoUrl})`;
                    avatarElement.style.backgroundSize = 'cover';
                    avatarElement.style.backgroundPosition = 'center';
                } else {
                    const displayName = profile.nickname || 'Usuário';
                    userAvatarFallback.textContent = displayName.charAt(0).toUpperCase();
                }
            } else {
                const displayName = profile.nickname || 'Usuário';
                userAvatarFallback.textContent = displayName.charAt(0).toUpperCase();
            }
        }

    } catch (error) {
        console.error('Erro ao carregar avatar do usuário:', error);
    }
}

async function loadUserPhoto(avatarUrl) {
    try {
        if (!avatarUrl) return null;

        const { data, error } = await supabase.storage
            .from('avatars')
            .download(avatarUrl);

        if (error) {
            console.error('Erro ao baixar imagem:', error);
            return null;
        }

        return URL.createObjectURL(data);

    } catch (error) {
        console.error('Erro ao carregar foto:', error);
        return null;
    }
}

// ==================== EVENT LISTENERS ====================
function setupEventListeners() {
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    const profileForm = document.getElementById('profileForm');
    if (profileForm) {
        profileForm.addEventListener('submit', saveProfile);
    }

    const avatarInput = document.getElementById('avatarInput');
    if (avatarInput) {
        avatarInput.addEventListener('change', handleAvatarUpload);
    }

    const descriptionTextarea = document.getElementById('description');
    if (descriptionTextarea) {
        descriptionTextarea.addEventListener('input', updateCharCount);
    }
}

// ==================== LOGOUT ====================
async function logout() {
    try {
        const { error } = await supabase.auth.signOut();
        if (error) throw error;
        window.location.href = 'login.html';
    } catch (error) {
        console.error('Erro ao fazer logout:', error);
        alert('Erro ao fazer logout. Tente novamente.');
    }
}

// ==================== CARREGAR DADOS DO PERFIL ====================
async function loadProfileData() {
    try {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (error) throw error;

        const { data: userDetails, error: detailsError } = await supabase
            .from('user_details')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        fillForm(profile, userDetails);

    } catch (error) {
        console.error('Erro ao carregar dados do perfil:', error);
    }
}

function fillForm(profile, userDetails) {
    // PREENCHE NOME E NICKNAME AUTOMATICAMENTE
    document.getElementById('fullName').value = profile.full_name || '';
    document.getElementById('nickname').value = profile.nickname || '';
    
    if (profile.birth_date) {
        document.getElementById('birthDate').value = profile.birth_date;
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
        
        if (userDetails.interests) {
            const interests = Array.isArray(userDetails.interests) ? userDetails.interests : [userDetails.interests];
            document.querySelectorAll('input[name="interests"]').forEach(checkbox => {
                checkbox.checked = interests.includes(checkbox.value);
            });
        }
    }

    updateCharCount();
}

// ==================== SALVAR PERFIL ====================
async function saveProfile(event) {
    event.preventDefault();
    
    try {
        let avatarUrl = null;
        if (avatarFile) {
            avatarUrl = await uploadAvatar(avatarFile);
        }

        const profileData = {
            full_name: document.getElementById('fullName').value.trim(),
            nickname: document.getElementById('nickname').value.trim(),
            birth_date: document.getElementById('birthDate').value || null,
            updated_at: new Date().toISOString()
        };

        if (avatarUrl) {
            profileData.avatar_url = avatarUrl;
        }

        const userDetailsData = {
            phone: document.getElementById('phone').value.trim() || null,
            address: document.getElementById('location').value.trim() || null,
            gender: document.getElementById('gender').value || null,
            sexual_orientation: document.getElementById('sexualOrientation').value || null,
            profession: document.getElementById('profession').value.trim() || null,
            education: document.getElementById('education').value || null,
            zodiac: document.getElementById('zodiac').value || null,
            looking_for: document.getElementById('lookingFor').value || null,
            description: document.getElementById('description').value.trim() || null,
            religion: document.getElementById('religion').value || null,
            drinking: document.getElementById('drinking').value || null,
            smoking: document.getElementById('smoking').value || null,
            exercise: document.getElementById('exercise').value || null,
            exercise_details: document.getElementById('exerciseDetails').value.trim() || null,
            has_pets: document.getElementById('hasPets').value || null,
            pets_details: document.getElementById('petsDetails').value.trim() || null,
            updated_at: new Date().toISOString()
        };

        const selectedInterests = [];
        document.querySelectorAll('input[name="interests"]:checked').forEach(checkbox => {
            selectedInterests.push(checkbox.value);
        });
        userDetailsData.interests = selectedInterests.length > 0 ? selectedInterests : null;

        // VALIDAÇÕES
        if (!profileData.nickname) {
            alert('Por favor, informe um apelido/nickname.');
            return;
        }
        if (!profileData.birth_date) {
            alert('Por favor, informe sua data de nascimento.');
            return;
        }
        if (!userDetailsData.gender) {
            alert('Por favor, informe seu gênero.');
            return;
        }
        if (!userDetailsData.looking_for) {
            alert('Por favor, informe o que está procurando.');
            return;
        }

        // SALVAR NO BANCO
        const { error: profileError } = await supabase
            .from('profiles')
            .update(profileData)
            .eq('id', currentUser.id);

        if (profileError) throw profileError;

        const { error: detailsError } = await supabase
            .from('user_details')
            .update(userDetailsData)
            .eq('user_id', currentUser.id);

        if (detailsError) throw detailsError;

        await loadUserData();
        alert('Perfil salvo com sucesso! ✅');

    } catch (error) {
        console.error('Erro ao salvar perfil:', error);
        alert('Erro ao salvar perfil. Tente novamente.');
    }
}

// ==================== UPLOAD DE AVATAR ====================
async function handleAvatarUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Por favor, selecione uma imagem.');
        return;
    }

    if (file.size > 250 * 1024) {
        alert('A imagem deve ter no máximo 250KB.');
        return;
    }

    avatarFile = file;

    const reader = new FileReader();
    reader.onload = function(e) {
        const avatarPreviewImg = document.getElementById('avatarPreviewImg');
        const avatarFallback = document.getElementById('avatarFallback');
        const avatarPreview = document.getElementById('avatarPreview');

        avatarPreviewImg.src = e.target.result;
        avatarPreviewImg.style.display = 'block';
        avatarFallback.style.display = 'none';
        avatarPreview.style.backgroundImage = `url(${e.target.result})`;
    };
    reader.readAsDataURL(file);
}

async function uploadAvatar(file) {
    try {
        const fileExt = file.name.split('.').pop();
        const fileName = `${currentUser.id}-${Date.now()}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, file, {
                cacheControl: '3600',
                upsert: true
            });

        if (uploadError) throw uploadError;

        return fileName;

    } catch (error) {
        console.error('Erro ao fazer upload da imagem:', error);
        alert('Erro ao fazer upload da imagem. Tente novamente.');
        return null;
    }
}

// ==================== FUNÇÕES AUXILIARES ====================
function updateCharCount() {
    const textarea = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    if (textarea && charCount) {
        charCount.textContent = textarea.value.length;
    }
}