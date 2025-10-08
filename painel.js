// Configuração do Supabase
const SUPABASE_URL = 'https://gcukalndarlgydmgmmmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;

document.addEventListener('DOMContentLoaded', function() {
    checkAuth();
});

// VERIFICA SE USUÁRIO ESTÁ LOGADO
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    currentUser = user;
    loadUserData();
    loadProfileData();
}

// CARREGA DADOS BÁSICOS DO USUÁRIO
async function loadUserData() {
    // PREENCHE E-MAIL AUTOMATICAMENTE
    document.getElementById('email').value = currentUser.email;
    
    // Busca nickname do perfil
    const { data: profile } = await supabase
        .from('profiles')
        .select('nickname')
        .eq('id', currentUser.id)
        .single();
    
    if (profile && profile.nickname) {
        document.getElementById('userNickname').textContent = profile.nickname;
        document.getElementById('mobileUserNickname').textContent = profile.nickname;
    }
}

// CARREGA DADOS DO PERFIL
async function loadProfileData() {
    try {
        // Busca dados do perfil
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        // Busca detalhes do usuário
        const { data: userDetails } = await supabase
            .from('user_details')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

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

    } catch (error) {
        console.log('Erro ao carregar perfil:', error);
    }
}

// SALVA O PERFIL - SIMPLES E FUNCIONAL
async function saveProfile(event) {
    event.preventDefault();
    
    try {
        // Dados básicos do perfil
        const profileData = {
            full_name: document.getElementById('fullName').value,
            nickname: document.getElementById('nickname').value,
            birth_date: document.getElementById('birthDate').value,
            updated_at: new Date().toISOString()
        };

        // Dados detalhados
        const userDetailsData = {
            phone: document.getElementById('phone').value,
            address: document.getElementById('location').value,
            gender: document.getElementById('gender').value,
            sexual_orientation: document.getElementById('sexualOrientation').value,
            profession: document.getElementById('profession').value,
            education: document.getElementById('education').value,
            zodiac: document.getElementById('zodiac').value,
            looking_for: document.getElementById('lookingFor').value,
            description: document.getElementById('description').value,
            religion: document.getElementById('religion').value,
            drinking: document.getElementById('drinking').value,
            smoking: document.getElementById('smoking').value,
            exercise: document.getElementById('exercise').value,
            exercise_details: document.getElementById('exerciseDetails').value,
            has_pets: document.getElementById('hasPets').value,
            pets_details: document.getElementById('petsDetails').value,
            updated_at: new Date().toISOString()
        };

        // Coleta interesses
        const selectedInterests = [];
        document.querySelectorAll('input[name="interests"]:checked').forEach(checkbox => {
            selectedInterests.push(checkbox.value);
        });
        userDetailsData.interests = selectedInterests;

        // VALIDAÇÕES BÁSICAS
        if (!profileData.nickname) {
            alert('Informe um nickname!');
            return;
        }
        if (!profileData.birth_date) {
            alert('Informe a data de nascimento!');
            return;
        }
        if (!userDetailsData.gender) {
            alert('Informe o gênero!');
            return;
        }
        if (!userDetailsData.looking_for) {
            alert('Informe o que procura!');
            return;
        }

        // SALVA NO BANCO - SIMPLES E DIRETO
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

        // ATUALIZA A TELA
        document.getElementById('userNickname').textContent = profileData.nickname;
        document.getElementById('mobileUserNickname').textContent = profileData.nickname;
        
        alert('✅ Perfil salvo com sucesso!');

    } catch (error) {
        console.error('Erro ao salvar:', error);
        alert('❌ Erro ao salvar perfil!');
    }
}

// FUNÇÕES BÁSICAS
function updateCharCount() {
    const textarea = document.getElementById('description');
    const charCount = document.getElementById('charCount');
    if (textarea && charCount) {
        charCount.textContent = textarea.value.length;
    }
}

async function logout() {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
}

// CONFIGURA EVENTOS
function setupEventListeners() {
    document.getElementById('profileForm').addEventListener('submit', saveProfile);
    document.getElementById('logoutBtn').addEventListener('click', logout);
    document.getElementById('mobileLogoutBtn').addEventListener('click', logout);
    document.getElementById('description').addEventListener('input', updateCharCount);
}

// INICIA TUDO
setupEventListeners();