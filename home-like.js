// ==================== SISTEMA PULSE/CURTIR ====================
class PulseSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.userProfile = null;
        this.pulsesData = {
            given: new Set(),
            received: new Set(),  
            matches: new Set()
        };
    }

    async initialize() {
        try {
            if (!this.currentUser) return;

            await this.loadUserProfile();
            await this.loadPulsesData();
            await this.integrateWithUserCards();
            this.updatePulseCounters();
            
            console.log('✅ Sistema Pulse pronto!');

        } catch (error) {
            console.error('Erro no Pulse:', error);
        }
    }

    async loadUserProfile() {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (!error) this.userProfile = profile;
        } catch (error) {
            console.error('Erro perfil:', error);
        }
    }

    async loadPulsesData() {
        try {
            // Curtidas que EU dei
            const { data: givenPulses } = await this.supabase
                .from('pulses')
                .select('user_to_id')
                .eq('user_from_id', this.currentUser.id)
                .eq('status', 'active');

            if (givenPulses) {
                givenPulses.forEach(pulse => {
                    this.pulsesData.given.add(pulse.user_to_id);
                });
            }

            // Curtidas que EU recebi
            const { data: receivedPulses } = await this.supabase
                .from('pulses')
                .select('user_from_id')
                .eq('user_to_id', this.currentUser.id)
                .eq('status', 'active');

            if (receivedPulses) {
                receivedPulses.forEach(pulse => {
                    this.pulsesData.received.add(pulse.user_from_id);
                    if (this.pulsesData.given.has(pulse.user_from_id)) {
                        this.pulsesData.matches.add(pulse.user_from_id);
                    }
                });
            }

        } catch (error) {
            console.error('Erro pulses:', error);
        }
    }

    async integrateWithUserCards() {
        await this.waitForUserCards();
        
        const userCards = document.querySelectorAll('.user-card');
        userCards.forEach(card => {
            this.addPulseButtonToCard(card);
            this.updateCardPulseStatus(card);
        });

        // Observar novos cards
        this.observeNewCards();
    }

    observeNewCards() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList?.contains('user-card')) {
                        this.addPulseButtonToCard(node);
                        this.updateCardPulseStatus(node);
                    }
                    
                    if (node.querySelectorAll) {
                        node.querySelectorAll('.user-card').forEach(card => {
                            this.addPulseButtonToCard(card);
                            this.updateCardPulseStatus(card);
                        });
                    }
                });
            });
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    addPulseButtonToCard(card) {
        if (card.querySelector('.pulse-btn')) return;

        const userId = card.getAttribute('data-user-id');
        if (!userId) return;

        const actionsContainer = card.querySelector('.user-card-actions');
        if (!actionsContainer) return;

        const pulseBtn = document.createElement('button');
        pulseBtn.className = 'pulse-btn';
        pulseBtn.innerHTML = '💗 Pulse';
        pulseBtn.setAttribute('data-user-id', userId);
        
        actionsContainer.insertBefore(pulseBtn, actionsContainer.firstChild);
        
        pulseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handlePulseClick(userId, pulseBtn);
        });

        this.updatePulseButtonState(pulseBtn, userId);
    }

    updatePulseButtonState(button, userId) {
        const isGiven = this.pulsesData.given.has(userId);
        const isMatch = this.pulsesData.matches.has(userId);
        const isReceived = this.pulsesData.received.has(userId);
        const isPremium = this.userProfile?.is_premium;

        button.classList.remove('pulse-active', 'pulse-match', 'pulse-received');
        
        if (isMatch) {
            button.innerHTML = '💝 Match!';
            button.classList.add('pulse-match');
            button.title = 'Vocês têm um match!';
        } 
        else if (isGiven) {
            button.innerHTML = '💗 Curtido';
            button.classList.add('pulse-active');
            button.title = 'Você já curtiu esta pessoa';
        }
        else if (isReceived && isPremium) {
            button.innerHTML = '💖 Te curtiu!';
            button.classList.add('pulse-received');
            button.title = 'Esta pessoa te curtiu!';
        }
        else {
            button.innerHTML = '💗 Pulse';
            button.title = 'Curtir este perfil';
        }
    }

    updateCardPulseStatus(card) {
        const userId = card.getAttribute('data-user-id');
        if (!userId) return;

        const pulseBtn = card.querySelector('.pulse-btn');
        if (pulseBtn) {
            this.updatePulseButtonState(pulseBtn, userId);
        }

        this.addCardVisualIndicators(card, userId);
    }

    addCardVisualIndicators(card, userId) {
        card.querySelectorAll('.pulse-indicator').forEach(ind => ind.remove());

        const isMatch = this.pulsesData.matches.has(userId);
        const isReceived = this.pulsesData.received.has(userId);
        const isPremium = this.userProfile?.is_premium;

        if (isMatch) {
            const matchBadge = document.createElement('div');
            matchBadge.className = 'pulse-indicator match-badge';
            matchBadge.innerHTML = '💝 Match';
            matchBadge.style.cssText = `
                position: absolute; top: 10px; right: 10px;
                background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                color: white; padding: 4px 8px; border-radius: 12px;
                font-size: 0.7rem; font-weight: bold; z-index: 10;
            `;
            card.style.position = 'relative';
            card.appendChild(matchBadge);
        }
        else if (isReceived && isPremium) {
            const likedBadge = document.createElement('div');
            likedBadge.className = 'pulse-indicator liked-badge';
            likedBadge.innerHTML = '💖 Te curtiu';
            likedBadge.style.cssText = `
                position: absolute; top: 10px; right: 10px;
                background: linear-gradient(135deg, #d1656d, #c44569);
                color: white; padding: 4px 8px; border-radius: 12px;
                font-size: 0.7rem; font-weight: bold; z-index: 10;
            `;
            card.style.position = 'relative';
            card.appendChild(likedBadge);
        }
    }

    async handlePulseClick(userId, button) {
        try {
            const isGiven = this.pulsesData.given.has(userId);
            
            if (isGiven) {
                await this.revokePulse(userId);
                this.pulsesData.given.delete(userId);
                this.pulsesData.matches.delete(userId);
                await this.removeFromVipList(userId);
                this.showPulseToast('Curtida removida', 'info');
            } else {
                await this.createPulse(userId);
                this.pulsesData.given.add(userId);
                await this.saveLikeToVipList(userId);
                
                if (this.pulsesData.received.has(userId)) {
                    this.pulsesData.matches.add(userId);
                    this.showPulseToast('💝 Novo match!', 'success');
                } else {
                    this.showPulseToast('Curtida enviada!', 'success');
                }
            }

            this.updatePulseButtonState(button, userId);
            this.updateCardPulseStatus(button.closest('.user-card'));
            this.updatePulseCounters();

        } catch (error) {
            console.error('Erro pulse:', error);
            this.showPulseToast('Erro ao curtir', 'error');
        }
    }

    async createPulse(userToId) {
        const { data, error } = await this.supabase
            .from('pulses')
            .insert({
                user_from_id: this.currentUser.id,
                user_to_id: userToId,
                status: 'active'
            })
            .select()
            .single();

        if (error) {
            if (error.code === '23505') {
                await this.supabase
                    .from('pulses')
                    .update({ status: 'active' })
                    .eq('user_from_id', this.currentUser.id)
                    .eq('user_to_id', userToId);
            } else {
                throw error;
            }
        }

        return data;
    }

    async revokePulse(userToId) {
        const { error } = await this.supabase
            .from('pulses')
            .update({ status: 'revoked' })
            .eq('user_from_id', this.currentUser.id)
            .eq('user_to_id', userToId);

        if (error) throw error;
    }

    async saveLikeToVipList(targetUserId) {
        try {
            const { data: vipData, error: vipError } = await this.supabase
                .from('vip_list')
                .insert({
                    user_id: this.currentUser.id,
                    vip_user_id: targetUserId,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (vipError) {
                if (vipError.code === '23505') {
                    console.log('ℹ️ Usuário já está na lista VIP');
                } else {
                    console.error('❌ Erro ao salvar na lista VIP:', vipError);
                }
            } else {
                console.log('✅ Salvo na lista VIP:', targetUserId);
            }

        } catch (error) {
            console.error('❌ Erro ao salvar VIP:', error);
        }
    }

    async removeFromVipList(targetUserId) {
        try {
            const { error } = await this.supabase
                .from('vip_list')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('vip_user_id', targetUserId);

            if (error) {
                console.error('❌ Erro ao remover da lista VIP:', error);
            } else {
                console.log('✅ Removido da lista VIP:', targetUserId);
            }
        } catch (error) {
            console.error('❌ Erro ao remover VIP:', error);
        }
    }

    async getVipList() {
        if (!this.userProfile?.is_premium) {
            this.showPulseToast('Recurso exclusivo para Premium', 'warning');
            return [];
        }

        try {
            const { data: vipUsers, error } = await this.supabase
                .from('vip_list')
                .select(`
                    vip_user_id,
                    created_at,
                    profiles:vip_user_id (
                        id,
                        nickname,
                        avatar_url,
                        birth_date,
                        zodiac,
                        profession,
                        user_details (
                            gender,
                            interests,
                            description,
                            looking_for
                        )
                    )
                `)
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            const formattedVipUsers = vipUsers?.map(vip => ({
                user_from_id: vip.vip_user_id,
                created_at: vip.created_at,
                profiles: vip.profiles
            })) || [];

            return formattedVipUsers;

        } catch (error) {
            console.error('Erro buscar VIP:', error);
            return [];
        }
    }

    async addVipCardsToHome() {
        if (!this.userProfile?.is_premium) return;

        try {
            const vipUsers = await this.getVipList();
            if (vipUsers.length === 0) return;

            const usersSection = document.querySelector('.users-section');
            if (!usersSection) return;

            this.createVipUsersSection(usersSection, vipUsers);

        } catch (error) {
            console.error('❌ Erro ao adicionar cards VIP:', error);
        }
    }

    createVipUsersSection(container, vipUsers) {
        if (document.getElementById('vipUsersSection')) return;

        const vipSection = document.createElement('div');
        vipSection.id = 'vipUsersSection';
        vipSection.style.marginBottom = '3rem';
        vipSection.innerHTML = `
            <div class="section-header">
                <h2>⭐ Sua Lista VIP</h2>
                <span class="pulse-badge">${vipUsers.length} pessoas</span>
            </div>
            <div class="users-grid" id="vipUsersGrid">
                <div class="loading">
                    <div class="spinner"></div>
                    <p>Carregando lista VIP...</p>
                </div>
            </div>
        `;

        container.parentNode.insertBefore(vipSection, container);

        setTimeout(() => {
            this.addVipUserCards(vipUsers);
        }, 100);
    }

    async addVipUserCards(vipUsers) {
        const vipGrid = document.getElementById('vipUsersGrid');
        if (!vipGrid) return;

        vipGrid.innerHTML = '';

        for (const vip of vipUsers) {
            try {
                const cardHtml = await this.createVipUserCard(vip);
                if (cardHtml) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = cardHtml;
                    if (tempDiv.firstElementChild) {
                        vipGrid.appendChild(tempDiv.firstElementChild);
                    }
                }
            } catch (error) {
                console.error('Erro ao criar card VIP:', error);
            }
        }
    }

    async createVipUserCard(vipData) {
        try {
            const user = vipData.profiles;
            const userId = vipData.user_from_id;
            const nickname = user.nickname || 'Usuário';
            const age = user.birth_date ? this.calculateAge(user.birth_date) : null;
            const zodiac = user.zodiac;
            const profession = user.profession;
            const bio = user.user_details?.description || 'Este usuário ainda não adicionou uma descrição.';

            let avatarHtml = '';
            if (user.avatar_url) {
                const { data } = this.supabase.storage.from('avatars').getPublicUrl(user.avatar_url);
                avatarHtml = `
                    <div class="user-card-avatar">
                        <img class="user-card-avatar-img" src="${data?.publicUrl}" alt="${nickname}">
                        <div class="user-card-avatar-fallback" style="display: none;">${nickname.charAt(0).toUpperCase()}</div>
                    </div>
                `;
            } else {
                avatarHtml = `
                    <div class="user-card-avatar">
                        <div class="user-card-avatar-fallback">${nickname.charAt(0).toUpperCase()}</div>
                    </div>
                `;
            }

            return `
                <div class="user-card vip-card" data-user-id="${userId}" onclick="viewProfile('${userId}')">
                    ${avatarHtml}
                    <div class="user-card-name">${nickname}${age ? `, ${age}` : ''}</div>
                    
                    <div class="user-card-info">
                        ${zodiac ? `<div class="user-card-detail">${this.getZodiacIcon(zodiac)} ${this.formatZodiac(zodiac)}</div>` : ''}
                        ${profession ? `<div class="user-card-detail">💼 ${profession}</div>` : ''}
                        <div class="user-card-detail">⭐ Na sua lista VIP</div>
                    </div>
                    
                    <div class="user-card-bio">${bio}</div>
                    
                    <div class="user-card-actions">
                        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); sendMessage('${userId}')">
                            💬 Mensagem
                        </button>
                        <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); viewProfile('${userId}')">
                            👁️ Ver Perfil
                        </button>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error('Erro ao criar card VIP:', error);
            return '';
        }
    }

    updatePulseCounters() {
        if (this.userProfile?.is_premium) {
            const matchesCount = this.pulsesData.matches.size;
            const receivedCount = this.pulsesData.received.size;
            
            const matchesElement = document.getElementById('matchesCount');
            const receivedElement = document.getElementById('receivedPulsesCount');
            
            if (matchesElement) matchesElement.textContent = matchesCount;
            if (receivedElement) receivedElement.textContent = receivedCount;
        }
    }

    showPulseToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: ${type === 'success' ? '#38a169' : type === 'error' ? '#e53e3e' : '#d1656d'};
            color: white; padding: 12px 20px; border-radius: 25px;
            font-weight: 600; z-index: 10000; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async waitForUserCards() {
        return new Promise((resolve) => {
            const checkCards = () => {
                const cards = document.querySelectorAll('.user-card');
                if (cards.length > 0) resolve();
                else setTimeout(checkCards, 100);
            };
            checkCards();
        });
    }

    calculateAge(birthDate) {
        if (!birthDate) return null;
        const today = new Date();
        const birth = new Date(birthDate);
        let age = today.getFullYear() - birth.getFullYear();
        const monthDiff = today.getMonth() - birth.getMonth();
        if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
            age--;
        }
        return age;
    }

    formatZodiac(zodiac) {
        const zodiacMap = {
            'aries': 'Áries', 'taurus': 'Touro', 'gemini': 'Gêmeos', 'cancer': 'Câncer',
            'leo': 'Leão', 'virgo': 'Virgem', 'libra': 'Libra', 'scorpio': 'Escorpião',
            'sagittarius': 'Sagitário', 'capricorn': 'Capricórnio', 'aquarius': 'Aquário', 'pisces': 'Peixes'
        };
        return zodiacMap[zodiac?.toLowerCase()] || zodiac;
    }

    getZodiacIcon(zodiac) {
        const zodiacIcons = {
            'aries': '♈', 'taurus': '♉', 'gemini': '♊', 'cancer': '♋',
            'leo': '♌', 'virgo': '♍', 'libra': '♎', 'scorpio': '♏',
            'sagittarius': '♐', 'capricorn': '♑', 'aquarius': '♒', 'pisces': '♓'
        };
        return zodiacIcons[zodiac?.toLowerCase()] || '✨';
    }

    isUserLiked(userId) {
        return this.pulsesData.given.has(userId);
    }

    isMatch(userId) {
        return this.pulsesData.matches.has(userId);
    }

    getGivenPulsesCount() {
        return this.pulsesData.given.size;
    }

    getReceivedPulsesCount() {
        return this.pulsesData.received.size;
    }

    getMatchesCount() {
        return this.pulsesData.matches.size;
    }
}

// INICIALIZAÇÃO GLOBAL
let pulseSystem = null;

async function initializePulseSystem(supabase, currentUser) {
    if (pulseSystem) return pulseSystem;
    
    pulseSystem = new PulseSystem(supabase, currentUser);
    await pulseSystem.initialize();
    
    return pulseSystem;
}

// ESTILOS
function addPulseStyles() {
    if (document.getElementById('pulse-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'pulse-styles';
    styles.textContent = `
        .pulse-btn {
            background: linear-gradient(135deg, #d1656d, #c44569);
            color: white; border: none; padding: 0.6rem 1rem;
            border-radius: 20px; font-weight: 600; cursor: pointer;
            transition: all 0.3s ease; font-size: 0.85rem; min-width: 80px;
        }
        .pulse-btn:hover { transform: translateY(-2px); }
        .pulse-btn.pulse-active { background: linear-gradient(135deg, #667eea, #764ba2); }
        .pulse-btn.pulse-match { 
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            animation: pulse 2s infinite;
        }
        .pulse-btn.pulse-received { background: linear-gradient(135deg, #f093fb, #f5576c); }
        .vip-card {
            position: relative;
            border: 2px solid #ffd700 !important;
            background: linear-gradient(135deg, #fffaf0, #fff9c4) !important;
        }
        .vip-card::before {
            content: '⭐ VIP';
            position: absolute; top: -10px; right: -10px;
            background: linear-gradient(135deg, #ffd700, #ff6b00);
            color: white; padding: 4px 8px; border-radius: 12px;
            font-size: 0.7rem; font-weight: bold; z-index: 10;
        }
        .pulse-badge {
            background: linear-gradient(135deg, #d1656d, #c44569);
            color: white; padding: 0.3rem 0.8rem; border-radius: 15px;
            font-size: 0.8rem; font-weight: bold;
        }
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
    `;
    document.head.appendChild(styles);
}

window.PulseSystem = PulseSystem;
window.initializePulseSystem = initializePulseSystem;
addPulseStyles();

console.log('✅ Sistema Pulse COMPLETO carregado!');