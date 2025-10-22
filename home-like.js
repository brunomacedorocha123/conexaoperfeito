// ==================== SISTEMA PULSE ====================
class PulseSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.userProfile = null;
        this.pulsesData = { given: new Set(), received: new Set(), matches: new Set() };
    }

    async initialize() {
        try {
            if (!this.currentUser) return;
            await this.loadUserProfile();
            await this.loadPulsesData();
            await this.integrateWithUserCards();
            this.updatePulseCounters();
            console.log('✅ Pulse System: Pronto');
        } catch (error) {
            console.error('❌ Pulse System:', error);
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
                givenPulses.forEach(pulse => this.pulsesData.given.add(pulse.user_to_id));
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

            console.log('📊 Pulse Data:', {
                dados: this.pulsesData.given.size,
                recebidos: this.pulsesData.received.size,
                matches: this.pulsesData.matches.size
            });

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

        button.classList.remove('pulse-active', 'pulse-match');
        
        if (isMatch) {
            button.innerHTML = '💝 Match!';
            button.classList.add('pulse-match');
        } 
        else if (isGiven) {
            button.innerHTML = '💗 Curtido';
            button.classList.add('pulse-active');
        }
        else {
            button.innerHTML = '💗 Pulse';
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
                this.showPulseToast('Curtida removida');
            } else {
                await this.createPulse(userId);
                this.pulsesData.given.add(userId);
                await this.saveLikeToVipList(userId);
                
                if (this.pulsesData.received.has(userId)) {
                    this.pulsesData.matches.add(userId);
                    this.showPulseToast('💝 Novo match!');
                } else {
                    this.showPulseToast('Curtida enviada!');
                }
            }

            this.updatePulseButtonState(button, userId);
            this.updatePulseCounters();

        } catch (error) {
            console.error('Erro pulse:', error);
            this.showPulseToast('Erro ao curtir');
        }
    }

    async createPulse(userToId) {
        const { error } = await this.supabase
            .from('pulses')
            .insert({
                user_from_id: this.currentUser.id,
                user_to_id: userToId,
                status: 'active'
            });

        if (error && error.code === '23505') {
            await this.supabase
                .from('pulses')
                .update({ status: 'active' })
                .eq('user_from_id', this.currentUser.id)
                .eq('user_to_id', userToId);
        }
    }

    async revokePulse(userToId) {
        await this.supabase
            .from('pulses')
            .update({ status: 'revoked' })
            .eq('user_from_id', this.currentUser.id)
            .eq('user_to_id', userToId);
    }

    async saveLikeToVipList(targetUserId) {
        try {
            const { data, error } = await this.supabase
                .from('vip_list')
                .insert({
                    user_id: this.currentUser.id,
                    vip_user_id: targetUserId
                })
                .select();

            if (error) {
                console.log('❌ Erro salvar VIP:', error);
            } else {
                console.log('✅ Salvo na lista VIP:', targetUserId);
            }

        } catch (error) {
            console.log('💥 Erro crítico VIP:', error);
        }
    }

    async removeFromVipList(targetUserId) {
        try {
            await this.supabase
                .from('vip_list')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('vip_user_id', targetUserId);
        } catch (error) {
            console.log('Erro remover VIP:', error);
        }
    }

    async getVipList() {
        try {
            const { data: vipUsers, error } = await this.supabase
                .from('vip_list')
                .select(`
                    vip_user_id,
                    created_at,
                    profiles:vip_user_id (
                        id, nickname, avatar_url, birth_date, zodiac, profession,
                        user_details (gender, interests, description, looking_for)
                    )
                `)
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return vipUsers?.map(vip => ({
                user_from_id: vip.vip_user_id,
                created_at: vip.created_at,
                profiles: vip.profiles
            })) || [];

        } catch (error) {
            console.error('Erro buscar VIP:', error);
            return [];
        }
    }

    updatePulseCounters() {
        // Atualizar contadores na home
        const matchesElement = document.getElementById('newMatches');
        if (matchesElement) {
            matchesElement.textContent = this.pulsesData.matches.size;
        }
    }

    showPulseToast(message) {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: #38a169; color: white; padding: 12px 20px; border-radius: 25px;
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

    isUserLiked(userId) {
        return this.pulsesData.given.has(userId);
    }

    isMatch(userId) {
        return this.pulsesData.matches.has(userId);
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

console.log('✅ Sistema Pulse COMPLETO!');