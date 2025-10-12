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
            
            const { data, error } = await supabase
                .rpc('is_user_premium', { user_uuid: user.id });
            
            if (error) {
                console.log('ℹ️ Usuário não é premium');
                return false;
            }
            
            return data || false;
        } catch (error) {
            console.error('Erro:', error);
            return false;
        }
    }
};

// 👀 SISTEMA DE VISITANTES
class VisitantesManager {
    constructor() {
        this.visitors = [];
        this.isPremium = false;
    }

    async initialize() {
        console.log('👀 Inicializando sistema de visitantes...');
        
        // Verifica se é premium
        this.isPremium = await PremiumManager.checkPremiumStatus();
        
        if (this.isPremium) {
            await this.loadVisitors();
            this.showVisitorsSection();
        } else {
            await this.showLockedSection();
        }
    }

    async loadVisitors() {
        try {
            console.log('📥 Carregando visitantes...');
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const { data, error } = await supabase
                .from('profile_visits')
                .select(`
                    id,
                    visited_at,
                    visitor:visitor_id (
                        id,
                        nickname,
                        avatar_url,
                        city,
                        state
                    )
                `)
                .eq('visited_id', user.id)
                .order('visited_at', { ascending: false })
                .limit(10);

            if (error) {
                console.log('ℹ️ Nenhum visitante encontrado');
                return;
            }

            this.visitors = data || [];
            console.log(`✅ ${this.visitors.length} visitantes carregados`);
            
            this.updateVisitorsUI();

        } catch (error) {
            console.error('❌ Erro no carregamento:', error);
        }
    }

    updateVisitorsUI() {
        const visitorsList = document.getElementById('visitorsList');
        const visitorsCount = document.getElementById('visitorsCount');
        const noVisitors = document.getElementById('noVisitors');
        const visitorsActions = document.getElementById('visitorsActions');

        if (!visitorsList) return;

        // Atualiza contador
        if (visitorsCount) {
            visitorsCount.textContent = `${this.visitors.length} visita${this.visitors.length !== 1 ? 's' : ''}`;
        }

        // Mostra/oculta "sem visitantes"
        if (noVisitors) {
            noVisitors.style.display = this.visitors.length === 0 ? 'block' : 'none';
        }

        // Mostra botão "ver todos" se tiver visitantes
        if (visitorsActions) {
            visitorsActions.classList.toggle('hidden', this.visitors.length === 0);
        }

        // Renderiza lista de visitantes
        if (this.visitors.length > 0) {
            visitorsList.innerHTML = this.visitors.map(visit => this.createVisitorCard(visit)).join('');
        }
    }

    createVisitorCard(visit) {
        const visitor = visit.visitor;
        const visitDate = new Date(visit.visited_at);
        const timeAgo = this.getTimeAgo(visitDate);
        
        const displayCity = visitor?.city && visitor?.state ? 
            `${visitor.city}, ${visitor.state}` : 'Localização não informada';
        
        return `
            <div class="visitor-card" onclick="viewVisitorProfile('${visitor?.id}')">
                <div class="visitor-avatar">
                    ${visitor?.avatar_url ? 
                        `<img src="${visitor.avatar_url}" alt="${visitor.nickname}" onerror="this.style.display='none'">` : 
                        `<span>${visitor?.nickname?.charAt(0)?.toUpperCase() || 'U'}</span>`
                    }
                </div>
                <div class="visitor-info">
                    <div class="visitor-name">${visitor?.nickname || 'Usuário'}</div>
                    <div class="visitor-details">
                        <span>${displayCity}</span>
                    </div>
                </div>
                <div class="visit-time">${timeAgo}</div>
            </div>
        `;
    }

    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Agora';
        if (diffMins < 60) return `${diffMins} min`;
        if (diffHours < 24) return `${diffHours} h`;
        if (diffDays < 7) return `${diffDays} dia${diffDays > 1 ? 's' : ''}`;
        return date.toLocaleDateString('pt-BR');
    }

    async showLockedSection() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const { count, error } = await supabase
                .from('profile_visits')
                .select('*', { count: 'exact', head: true })
                .eq('visited_id', user.id);

            if (error) {
                console.log('ℹ️ Erro ao contar visitas');
                return;
            }

            const lockedCount = document.getElementById('lockedVisitorsCount');
            if (lockedCount) {
                lockedCount.textContent = count || 0;
            }

            // Mostra seção bloqueada
            const visitorsSection = document.getElementById('visitorsSection');
            const premiumLock = document.getElementById('premiumVisitorsLock');
            
            if (visitorsSection) visitorsSection.classList.add('hidden');
            if (premiumLock) premiumLock.classList.remove('hidden');
        } catch (error) {
            console.error('❌ Erro ao carregar contagem de visitantes:', error);
        }
    }

    showVisitorsSection() {
        const visitorsSection = document.getElementById('visitorsSection');
        const premiumLock = document.getElementById('premiumVisitorsLock');
        
        if (visitorsSection) visitorsSection.classList.remove('hidden');
        if (premiumLock) premiumLock.classList.add('hidden');
    }
}

// 📍 REGISTRADOR DE VISITAS
class VisitTracker {
    static async trackVisit(visitedUserId) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            // Não registra se for o próprio usuário
            if (!user || user.id === visitedUserId) return;

            console.log(`👀 Registrando visita: ${user.id} → ${visitedUserId}`);

            const { error } = await supabase
                .from('profile_visits')
                .insert({
                    visitor_id: user.id,
                    visited_id: visitedUserId,
                    visited_at: new Date().toISOString()
                });

            if (error && error.code !== '23505') {
                console.log('ℹ️ Erro ao registrar visita');
            } else {
                console.log('✅ Visita registrada com sucesso');
            }

        } catch (error) {
            console.error('❌ Erro no tracker:', error);
        }
    }
}

// ✅ FUNÇÃO PARA VER PERFIL DO VISITANTE
function viewVisitorProfile(visitorId) {
    localStorage.setItem('viewingProfileId', visitorId);
    window.location.href = 'perfil.html';
}

document.addEventListener('DOMContentLoaded', function() {
    console.log('🚀 Inicializando painel...');
    checkAuth();
});

// VERIFICA SE USUÁRIO ESTÁ LOGADO
async function checkAuth() {
    console.log('🔐 Verificando autenticação...');
    const { data: { user }, error } = await supabase.auth.getUser();
    
    if (error || !user) {
        console.log('❌ Usuário não autenticado');
        window.location.href = 'login.html';
        return;
    }
    
    currentUser = user;
    console.log('✅ Usuário autenticado:', user.email);
    
    // Inicializa tudo
    setupEventListeners();
    await loadUserData();
    await loadProfileData();
    await updatePremiumStatus();
    await updateProfileCompletion();
    await updatePlanStatus();
    
    // ✅ INICIALIZA SISTEMA DE VISITANTES
    const visitantesManager = new VisitantesManager();
    await visitantesManager.initialize();
}

// CONFIGURA EVENTOS
function setupEventListeners() {
    console.log('🎯 Configurando event listeners...');
    
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

// MÁSCARAS DE FORMULÁRIO
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

// ATUALIZAR STATUS DO PLANO
async function updatePlanStatus() {
    try {
        const isPremium = await PremiumManager.checkPremiumStatus();
        const planCard = document.getElementById('planStatusCard');
        const planBadge = document.getElementById('planBadge');
        const planDescription = document.getElementById('planDescription');
        const planActions = document.getElementById('planActions');

        if (isPremium) {
            if (planCard) planCard.classList.add('premium');
            if (planBadge) {
                planBadge.textContent = 'PREMIUM';
                planBadge.className = 'plan-badge premium';
            }
            if (planDescription) planDescription.textContent = 'Plano Premium com todos os benefícios ativos!';
            if (planActions) {
                planActions.innerHTML = `
                    <button class="btn btn-primary" onclick="window.location.href='mensagens.html'">
                        🚀 Ir para Mensagens
                    </button>
                `;
            }
            
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
                        <span class="feature-icon">👁️</span>
                        <span class="feature-text">Modo invisível</span>
                    </div>
                    <div class="feature-item">
                        <span class="feature-icon">👀</span>
                        <span class="feature-text">Ver visitantes</span>
                    </div>
                `;
            }
        } else {
            if (planCard) planCard.classList.remove('premium');
            if (planBadge) {
                planBadge.textContent = 'GRATUITO';
                planBadge.className = 'plan-badge gratuito';
            }
            if (planDescription) planDescription.textContent = 'Plano gratuito com funcionalidades básicas';
            if (planActions) {
                planActions.innerHTML = `
                    <a href="planos.html" class="btn btn-primary">⭐ Fazer Upgrade</a>
                `;
            }
        }

    } catch (error) {
        console.error('❌ Erro ao atualizar status do plano:', error);
    }
}

// ATUALIZAR STATUS PREMIUM
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
        }
    } catch (error) {
        console.error('❌ Erro ao verificar status premium:', error);
    }
}

// ATUALIZAR PROGRESSO DO PERFIL
async function updateProfileCompletion() {
    try {
        // Função simplificada para calcular progresso
        let percentage = 0;
        
        // Verifica campos obrigatórios preenchidos
        const requiredFields = [
            document.getElementById('fullName')?.value,
            document.getElementById('nickname')?.value,
            document.getElementById('birthDate')?.value,
            document.getElementById('gender')?.value,
            document.getElementById('lookingFor')?.value
        ];
        
        const filledFields = requiredFields.filter(field => field && field.trim()).length;
        percentage = (filledFields / requiredFields.length) * 100;

        const progressFill = document.getElementById('progressFill');
        const completionPercentage = document.getElementById('completionPercentage');
        const progressText = document.getElementById('progressText');

        if (progressFill) progressFill.style.width = `${percentage}%`;
        if (completionPercentage) completionPercentage.textContent = `${Math.round(percentage)}%`;
        
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
        console.error('❌ Erro ao atualizar progresso:', error);
    }
}

// CARREGA DADOS BÁSICOS DO USUÁRIO
async function loadUserData() {
    try {
        console.log('👤 Carregando dados do usuário...');
        
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
        
        if (error) {
            console.error('Erro ao carregar perfil:', error);
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
        } else {
            const fallbackName = currentUser.email.split('@')[0];
            document.getElementById('userNickname').textContent = fallbackName;
            document.getElementById('mobileUserNickname').textContent = fallbackName;
        }
    } catch (error) {
        console.error('❌ Erro ao carregar dados do usuário:', error);
        const fallbackName = currentUser?.email?.split('@')[0] || 'Usuário';
        document.getElementById('userNickname').textContent = fallbackName;
        document.getElementById('mobileUserNickname').textContent = fallbackName;
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

// ✅ CARREGA AVATAR - CÓDIGO CORRIGIDO
async function loadAvatar(avatarPath) {
    try {
        console.log('🔄 Carregando avatar:', avatarPath);
        
        // ✅ CORREÇÃO: Usar await corretamente
        const { data, error } = await supabase.storage
            .from('avatars')
            .getPublicUrl(avatarPath);

        if (error) {
            console.error('❌ Erro ao obter URL pública:', error);
            showFallbackAvatars();
            return;
        }

        if (data && data.publicUrl) {
            updateAvatarImages(data.publicUrl);
        } else {
            showFallbackAvatars();
        }
    } catch (error) {
        console.error('❌ Erro ao carregar avatar:', error);
        showFallbackAvatars();
    }
}

// ATUALIZA IMAGENS DE AVATAR
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

// MOSTRA FALLBACK
function showFallbackAvatars() {
    document.querySelectorAll('.user-avatar-fallback, .avatar-fallback').forEach(fb => {
        fb.style.display = 'flex';
    });
}

// ✅ CARREGA DADOS DO PERFIL - VERSÃO CORRIGIDA
async function loadProfileData() {
    try {
        console.log('📋 Carregando dados do perfil...');
        
        // 1. Busca perfil principal
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', currentUser.id)
            .single();

        if (profileError) {
            console.error('❌ Erro no perfil:', profileError);
            return;
        }

        // 2. Busca detalhes do usuário
        const { data: userDetails, error: detailsError } = await supabase
            .from('user_details')
            .select('*')
            .eq('user_id', currentUser.id)
            .single();

        if (detailsError) {
            console.log('ℹ️ Detalhes não encontrados');
        }

        console.log('✅ Perfil carregado:', profile);
        console.log('✅ Detalhes carregados:', userDetails);

        // 3. PREENCHE OS CAMPOS DO FORMULÁRIO
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
            document.getElementById('email').value = currentUser.email || '';
            
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
        console.log('✅ Dados do perfil carregados');

    } catch (error) {
        console.error('❌ Erro ao carregar perfil:', error);
        showNotification('❌ Erro ao carregar dados do perfil', 'error');
    }
}

// HANDLE AVATAR SELECT
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

// UPLOAD DE AVATAR
async function uploadAvatar(file) {
    try {
        console.log('📤 Iniciando upload do avatar...');
        
        const fileExt = file.name.split('.').pop();
        const fileName = `${Date.now()}_avatar.${fileExt}`;
        const filePath = `${currentUser.id}/${fileName}`;

        console.log('📁 Fazendo upload para:', filePath);

        const { data, error } = await supabase.storage
            .from('avatars')
            .upload(filePath, file, {
                cacheControl: '3600',
                upsert: false
            });

        if (error) {
            console.error('❌ Erro no upload:', error);
            throw new Error(`Falha no upload: ${error.message}`);
        }

        console.log('✅ Upload realizado com sucesso:', data);
        return filePath;

    } catch (error) {
        console.error('❌ Erro completo no upload:', error);
        showNotification('⚠️ Imagem não pôde ser enviada, mas o perfil será salvo.', 'warning');
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
            try {
                avatarPath = await uploadAvatar(selectedAvatarFile);
                if (avatarPath) {
                    showNotification('✅ Imagem enviada com sucesso!', 'success');
                }
            } catch (uploadError) {
                console.error('❌ Upload falhou, continuando sem imagem:', uploadError);
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
        console.log('💾 Salvando no banco de dados...');
        showNotification('💾 Salvando dados do perfil...', 'info');

        // Atualiza perfil principal
        const { error: profileError } = await supabase
            .from('profiles')
            .upsert({
                id: currentUser.id,
                ...profileData
            }, { onConflict: 'id' });

        if (profileError) {
            console.error('❌ Erro ao salvar perfil:', profileError);
            throw profileError;
        }

        // Atualiza detalhes do usuário
        const { error: detailsError } = await supabase
            .from('user_details')
            .upsert({
                user_id: currentUser.id,
                ...userDetailsData
            }, { onConflict: 'user_id' });

        if (detailsError) {
            console.error('❌ Erro ao salvar detalhes:', detailsError);
            throw detailsError;
        }

        // Atualiza interface
        document.getElementById('userNickname').textContent = profileData.nickname;
        document.getElementById('mobileUserNickname').textContent = profileData.nickname;
        
        // Reseta o arquivo selecionado
        selectedAvatarFile = null;
        document.getElementById('avatarInput').value = '';
        
        console.log('✅ Perfil salvo com sucesso!');
        showNotification('✅ Perfil salvo com sucesso!', 'success');
        
        // ATUALIZA PROGRESSO APÓS SALVAR
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
    
    .hidden {
        display: none !important;
    }
`;
document.head.appendChild(style);