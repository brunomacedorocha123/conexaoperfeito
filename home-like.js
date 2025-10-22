// ==================== SISTEMA PULSE COMPLETO ====================
class PulseSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.pulsesData = { 
            given: new Set(), 
            received: new Set(), 
            matches: new Set() 
        };
    }

    async initialize() {
        try {
            console.log('🎯 Iniciando Pulse System...');
            if (!this.currentUser) return;
            
            await this.loadUserProfile();
            await this.loadPulsesData();
            console.log('✅ Pulse System: Pronto!');
        } catch (error) {
            console.error('❌ Erro inicialização Pulse:', error);
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

            // Curtidas que EU recebi
            const { data: receivedPulses } = await this.supabase
                .from('pulses')
                .select('user_from_id')
                .eq('user_to_id', this.currentUser.id)
                .eq('status', 'active');

            if (givenPulses) {
                givenPulses.forEach(pulse => this.pulsesData.given.add(pulse.user_to_id));
            }

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

    async createPulse(userToId) {
        try {
            console.log('💗 Criando pulse para:', userToId);
            
            // 1. Salvar no pulses
            const { error: pulseError } = await this.supabase
                .from('pulses')
                .insert({
                    user_from_id: this.currentUser.id,
                    user_to_id: userToId,
                    status: 'active'
                });

            if (pulseError && pulseError.code !== '23505') {
                throw pulseError;
            }

            // 2. ✅ CORREÇÃO CRÍTICA: SALVAR NA VIP_LIST
            const { error: vipError } = await this.supabase
                .from('vip_list')
                .insert({
                    user_id: this.currentUser.id,
                    vip_user_id: userToId
                });

            if (vipError && vipError.code !== '23505') {
                console.log('❌ Erro ao salvar na VIP_LIST:', vipError);
            } else {
                console.log('✅ Salvo na VIP_LIST:', userToId);
            }

            // 3. Atualizar dados locais
            this.pulsesData.given.add(userToId);

        } catch (error) {
            console.error('❌ Erro ao criar pulse:', error);
            throw error;
        }
    }

    async revokePulse(userToId) {
        try {
            console.log('🗑️ Revogando pulse para:', userToId);
            
            // 1. Atualizar pulses
            await this.supabase
                .from('pulses')
                .update({ status: 'revoked' })
                .eq('user_from_id', this.currentUser.id)
                .eq('user_to_id', userToId);

            // 2. ✅ CORREÇÃO CRÍTICA: REMOVER DA VIP_LIST
            await this.supabase
                .from('vip_list')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('vip_user_id', userToId);

            console.log('✅ Removido da VIP_LIST:', userToId);

            // 3. Atualizar dados locais
            this.pulsesData.given.delete(userToId);
            this.pulsesData.matches.delete(userToId);

        } catch (error) {
            console.error('❌ Erro ao revogar pulse:', error);
            throw error;
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
            return vipUsers || [];

        } catch (error) {
            console.error('❌ Erro buscar lista VIP:', error);
            return [];
        }
    }

    // Métodos de utilidade
    isUserLiked(userId) {
        return this.pulsesData.given.has(userId);
    }

    isMatch(userId) {
        return this.pulsesData.matches.has(userId);
    }

    getMatchesCount() {
        return this.pulsesData.matches.size;
    }

    updatePulseCounters() {
        const matchesElement = document.getElementById('newMatches');
        if (matchesElement) {
            matchesElement.textContent = this.getMatchesCount();
        }
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

console.log('✅ Sistema Pulse carregado!');