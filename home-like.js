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
        this.userProfile = null;
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
                
            if (error) throw error;
            this.userProfile = profile;
            console.log('✅ Perfil carregado no Pulse:', profile.nickname, 'Premium:', profile.is_premium);
        } catch (error) {
            console.error('❌ Erro carregar perfil:', error);
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

            console.log('📊 Pulses carregados:', {
                dados: this.pulsesData.given.size,
                recebidos: this.pulsesData.received.size,
                matches: this.pulsesData.matches.size
            });

        } catch (error) {
            console.error('❌ Erro carregar pulses:', error);
        }
    }

    async createPulse(userToId) {
        try {
            console.log('💗 Criando pulse para:', userToId);
            console.log('🔍 Verificando premium...');
            console.log('📊 UserProfile:', this.userProfile);
            console.log('⭐ is_premium:', this.userProfile?.is_premium);
            
            // 1. Salvar no pulses (para TODOS os usuários)
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

            // 2. ✅✅✅ CORREÇÃO DEFINITIVA: SALVAR NA VIP_LIST APENAS SE FOR PREMIUM
            if (this.userProfile?.is_premium) {
                console.log('🎯 Usuário PREMIUM - Inserindo na VIP_LIST...');
                
                const { data: vipData, error: vipError } = await this.supabase
                    .from('vip_list')
                    .insert({
                        user_id: this.currentUser.id,
                        vip_user_id: userToId
                    })
                    .select();

                if (vipError) {
                    console.error('❌ ERRO ao salvar na VIP_LIST:', vipError);
                    console.log('🔍 Detalhes do erro:', {
                        code: vipError.code,
                        message: vipError.message,
                        details: vipError.details
                    });
                    
                    // Se for erro de duplicidade, apenas logar
                    if (vipError.code === '23505') {
                        console.log('ℹ️ Usuário já está na VIP_LIST');
                    }
                } else {
                    console.log('✅✅✅ VIP_LIST salva com SUCESSO:', vipData);
                    
                    // Sinalizar atualização IMEDIATA
                    localStorage.setItem('vipListUpdate', 'true');
                    console.log('📢 Sinal de atualização enviado para lista-vip.html');
                }
            } else {
                console.log('ℹ️ Usuário Free - Pulse salvo, mas não na VIP_LIST');
            }

            // 3. Atualizar dados locais
            this.pulsesData.given.add(userToId);

            // 4. Verificar match
            if (this.pulsesData.received.has(userToId)) {
                this.pulsesData.matches.add(userToId);
                console.log('💝 NOVO MATCH detectado:', userToId);
            }

            return true;

        } catch (error) {
            console.error('❌ Erro ao criar pulse:', error);
            throw error;
        }
    }

    async revokePulse(userToId) {
        try {
            console.log('🗑️ Revogando pulse para:', userToId);
            
            // 1. Atualizar pulses (para TODOS os usuários)
            await this.supabase
                .from('pulses')
                .update({ status: 'revoked' })
                .eq('user_from_id', this.currentUser.id)
                .eq('user_to_id', userToId);

            // 2. ✅✅✅ CORREÇÃO: SÓ REMOVER DA VIP_LIST SE FOR PREMIUM
            if (this.userProfile?.is_premium) {
                console.log('🎯 Usuário PREMIUM - Removendo da VIP_LIST...');
                
                const { error: vipError } = await this.supabase
                    .from('vip_list')
                    .delete()
                    .eq('user_id', this.currentUser.id)
                    .eq('vip_user_id', userToId);

                if (vipError) {
                    console.error('❌ Erro ao remover da VIP_LIST:', vipError);
                } else {
                    console.log('✅ Removido da VIP_LIST (Premium):', userToId);
                    
                    // Sinalizar atualização para lista-vip.html
                    localStorage.setItem('vipListUpdate', 'true');
                }
            }

            // 3. Atualizar dados locais
            this.pulsesData.given.delete(userToId);
            this.pulsesData.matches.delete(userToId);

            return true;

        } catch (error) {
            console.error('❌ Erro ao revogar pulse:', error);
            throw error;
        }
    }

    async getVipList() {
        try {
            // ✅✅✅ VERIFICAÇÃO CRÍTICA: Só buscar se for premium
            if (!this.userProfile?.is_premium) {
                console.log('ℹ️ Usuário não premium - VIP list vazia');
                return [];
            }

            console.log('🔍 Buscando lista VIP do banco...');
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

            if (error) {
                console.error('❌ Erro na consulta VIP_LIST:', error);
                throw error;
            }
            
            console.log('📋 VIP List carregada:', vipUsers?.length || 0, 'usuários');
            return vipUsers || [];

        } catch (error) {
            console.error('❌ Erro buscar lista VIP:', error);
            return [];
        }
    }

    // ✅✅✅ NOVO MÉTODO: Buscar lista VIP diretamente (para lista-vip.html)
    async getVipListDirect() {
        try {
            console.log('🎯 Buscando lista VIP DIRETAMENTE...');
            
            // Verificar autenticação
            const { data: { user } } = await this.supabase.auth.getUser();
            if (!user) {
                console.error('❌ Usuário não autenticado');
                return [];
            }

            // ✅✅✅ VERIFICAÇÃO: Só buscar se for premium
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', user.id)
                .single();

            if (!profile?.is_premium) {
                console.log('ℹ️ Usuário não premium - acesso negado');
                return [];
            }

            console.log('🔍 Buscando VIP_LIST diretamente para:', user.id);
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
                .eq('user_id', user.id)
                .order('created_at', { ascending: false });

            if (error) {
                console.error('❌ Erro consulta VIP_LIST direta:', error);
                throw error;
            }

            console.log('✅ VIP List direta carregada:', vipUsers?.length || 0, 'usuários');
            return vipUsers || [];

        } catch (error) {
            console.error('❌ Erro buscar lista VIP direta:', error);
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

    // ✅✅✅ NOVO: Verificar status premium
    isUserPremium() {
        return this.userProfile?.is_premium || false;
    }

    // ✅✅✅ NOVO: Forçar atualização do perfil
    async refreshUserProfile() {
        await this.loadUserProfile();
        console.log('🔄 Perfil atualizado. Premium:', this.isUserPremium());
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

// ✅✅✅ CORREÇÃO: Inicialização para Lista VIP
async function initializePulseSystemForVip() {
    try {
        console.log('🎯 Inicializando Pulse System para Lista VIP...');
        
        const supabaseUrl = 'https://gcukalndarlgydmgmmmt.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        
        // Verificar autenticação
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            console.error('❌ Usuário não autenticado na Lista VIP');
            return null;
        }
        
        // Inicializar sistema
        const system = new PulseSystem(supabase, user);
        await system.initialize();
        
        console.log('✅ Pulse System inicializado para Lista VIP');
        return system;
        
    } catch (error) {
        console.error('❌ Erro inicializar Pulse para Lista VIP:', error);
        return null;
    }
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

// EXPORTAR PARA USO GLOBAL
window.PulseSystem = PulseSystem;
window.initializePulseSystem = initializePulseSystem;
window.initializePulseSystemForVip = initializePulseSystemForVip;
addPulseStyles();

console.log('✅ Sistema Pulse COMPLETO carregado!');