// ==================== SISTEMA PULSE COMPLETO ====================
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
            console.log('🎯 Iniciando Pulse System...');
            if (!this.currentUser) {
                console.error('❌ Usuário não autenticado');
                return;
            }
            
            await this.loadUserProfile();
            await this.loadPulsesData();
            await this.integrateWithUserCards();
            this.updatePulseCounters();
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
            console.log('✅ Perfil carregado:', profile.nickname);
        } catch (error) {
            console.error('❌ Erro carregar perfil:', error);
        }
    }

    async loadPulsesData() {
        try {
            console.log('📊 Carregando dados de pulses...');
            
            // Curtidas que EU dei
            const { data: givenPulses, error: givenError } = await this.supabase
                .from('pulses')
                .select('user_to_id')
                .eq('user_from_id', this.currentUser.id)
                .eq('status', 'active');

            if (givenError) throw givenError;

            // Curtidas que EU recebi
            const { data: receivedPulses, error: receivedError } = await this.supabase
                .from('pulses')
                .select('user_from_id')
                .eq('user_to_id', this.currentUser.id)
                .eq('status', 'active');

            if (receivedError) throw receivedError;

            // Processar dados
            if (givenPulses) {
                givenPulses.forEach(pulse => this.pulsesData.given.add(pulse.user_to_id));
            }

            if (receivedPulses) {
                receivedPulses.forEach(pulse => {
                    this.pulsesData.received.add(pulse.user_from_id);
                    // Verificar match
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
            console.error('❌ Erro carregar pulses:', error);
        }
    }

    async integrateWithUserCards() {
        console.log('🎴 Integrando com cards de usuário...');
        await this.waitForUserCards();
        const userCards = document.querySelectorAll('.user-card');
        
        userCards.forEach(card => {
            this.addPulseButtonToCard(card);
            this.updateCardPulseStatus(card);
        });
        
        console.log(`✅ ${userCards.length} cards processados`);
    }

    addPulseButtonToCard(card) {
        if (card.querySelector('.pulse-btn')) return;
        
        const userId = card.getAttribute('data-user-id');
        if (!userId) return;

        const actionsContainer = card.querySelector('.user-card-actions');
        if (!actionsContainer) return;

        // Criar botão pulse
        const pulseBtn = document.createElement('button');
        pulseBtn.className = 'pulse-btn';
        pulseBtn.innerHTML = '💗 Pulse';
        pulseBtn.setAttribute('data-user-id', userId);
        pulseBtn.setAttribute('title', 'Curtir este perfil');
        
        // Inserir antes do primeiro botão
        actionsContainer.insertBefore(pulseBtn, actionsContainer.firstChild);
        
        // Event listener
        pulseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handlePulseClick(userId, pulseBtn);
        });

        // Atualizar estado inicial
        this.updatePulseButtonState(pulseBtn, userId);
    }

    updatePulseButtonState(button, userId) {
        const isGiven = this.pulsesData.given.has(userId);
        const isMatch = this.pulsesData.matches.has(userId);

        button.classList.remove('pulse-active', 'pulse-match');
        
        if (isMatch) {
            button.innerHTML = '💝 Match!';
            button.classList.add('pulse-match');
            button.title = 'Vocês têm um match!';
        } 
        else if (isGiven) {
            button.innerHTML = '💗 Curtido';
            button.classList.add('pulse-active');
            button.title = 'Curtida enviada';
        }
        else {
            button.innerHTML = '💗 Pulse';
            button.title = 'Curtir este perfil';
        }
    }

    async handlePulseClick(userId, button) {
        try {
            console.log('💗 Clique no pulse para:', userId);
            
            const isGiven = this.pulsesData.given.has(userId);
            
            if (isGiven) {
                // Remover curtida
                await this.revokePulse(userId);
                this.pulsesData.given.delete(userId);
                this.pulsesData.matches.delete(userId);
                await this.removeFromVipList(userId);
                this.showPulseToast('Curtida removida');
            } else {
                // Adicionar curtida
                await this.createPulse(userId);
                this.pulsesData.given.add(userId);
                await this.saveLikeToVipList(userId);
                
                // Verificar match
                if (this.pulsesData.received.has(userId)) {
                    this.pulsesData.matches.add(userId);
                    this.showPulseToast('💝 Novo match!');
                    this.createMatchNotification(userId);
                } else {
                    this.showPulseToast('Curtida enviada!');
                }
            }

            // Atualizar UI
            this.updatePulseButtonState(button, userId);
            this.updatePulseCounters();

        } catch (error) {
            console.error('❌ Erro ao processar pulse:', error);
            this.showPulseToast('Erro ao curtir');
        }
    }

    async createPulse(userToId) {
        console.log('📝 Criando pulse para:', userToId);
        
        const { data, error } = await this.supabase
            .from('pulses')
            .insert({
                user_from_id: this.currentUser.id,
                user_to_id: userToId,
                status: 'active',
                created_at: new Date().toISOString()
            })
            .select();

        if (error) {
            if (error.code === '23505') {
                // Já existe, atualizar status
                console.log('🔄 Pulse já existe, atualizando...');
                await this.supabase
                    .from('pulses')
                    .update({ 
                        status: 'active',
                        created_at: new Date().toISOString()
                    })
                    .eq('user_from_id', this.currentUser.id)
                    .eq('user_to_id', userToId);
            } else {
                throw error;
            }
        }
        
        console.log('✅ Pulse criado/atualizado');
    }

    async revokePulse(userToId) {
        console.log('🗑️ Revogando pulse para:', userToId);
        
        const { error } = await this.supabase
            .from('pulses')
            .update({ 
                status: 'revoked',
                created_at: new Date().toISOString()
            })
            .eq('user_from_id', this.currentUser.id)
            .eq('user_to_id', userToId);

        if (error) throw error;
        console.log('✅ Pulse revogado');
    }

    async saveLikeToVipList(targetUserId) {
        try {
            console.log('⭐ Salvando na lista VIP:', targetUserId);
            
            const { data, error } = await this.supabase
                .from('vip_list')
                .insert({
                    user_id: this.currentUser.id,
                    vip_user_id: targetUserId,
                    created_at: new Date().toISOString()
                })
                .select();

            if (error) {
                if (error.code === '23505') {
                    console.log('ℹ️ Usuário já está na lista VIP');
                } else {
                    console.error('❌ Erro salvar VIP:', error);
                }
            } else {
                console.log('✅ Salvo na lista VIP:', targetUserId);
            }

        } catch (error) {
            console.error('💥 Erro crítico VIP:', error);
        }
    }

    async removeFromVipList(targetUserId) {
        try {
            console.log('🗑️ Removendo da lista VIP:', targetUserId);
            
            const { error } = await this.supabase
                .from('vip_list')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('vip_user_id', targetUserId);

            if (error) throw error;
            console.log('✅ Removido da lista VIP');

        } catch (error) {
            console.error('❌ Erro remover VIP:', error);
        }
    }

    async getVipList() {
        try {
            console.log('📋 Buscando lista VIP...');
            
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

            console.log(`✅ ${vipUsers?.length || 0} usuários na lista VIP`);
            
            return vipUsers?.map(vip => ({
                user_from_id: vip.vip_user_id,
                created_at: vip.created_at,
                profiles: vip.profiles
            })) || [];

        } catch (error) {
            console.error('❌ Erro buscar lista VIP:', error);
            return [];
        }
    }

    async addVipCardsToHome() {
        try {
            if (!this.userProfile?.is_premium) {
                console.log('ℹ️ Usuário não premium, sem cards VIP');
                return;
            }

            console.log('⭐ Adicionando cards VIP na home...');
            const vipUsers = await this.getVipList();
            
            if (vipUsers.length === 0) {
                console.log('ℹ️ Nenhum usuário na lista VIP');
                return;
            }

            // Aqui você pode adicionar os cards VIP em uma seção especial
            this.createVipSection(vipUsers);

        } catch (error) {
            console.error('❌ Erro adicionar cards VIP:', error);
        }
    }

    createVipSection(vipUsers) {
        const usersGrid = document.getElementById('usersGrid');
        if (!usersGrid) return;

        // Criar seção VIP
        const vipSection = document.createElement('div');
        vipSection.className = 'vip-section';
        vipSection.innerHTML = `
            <div class="section-header">
                <h2>⭐ Sua Lista VIP</h2>
                <span class="vip-badge">${vipUsers.length} pessoas</span>
            </div>
            <div class="vip-cards-container" id="vipCardsContainer">
                <!-- Cards VIP serão adicionados aqui -->
            </div>
        `;

        // Inserir antes da grade normal
        usersGrid.parentNode.insertBefore(vipSection, usersGrid);

        // Adicionar estilos VIP
        this.addVipStyles();
    }

    updatePulseCounters() {
        // Atualizar contadores na home
        const matchesElement = document.getElementById('newMatches');
        if (matchesElement) {
            matchesElement.textContent = this.pulsesData.matches.size;
        }

        // Atualizar badge de notificações se existir
        const pulseBadge = document.getElementById('pulseBadge');
        if (pulseBadge) {
            const totalPulses = this.pulsesData.received.size;
            pulseBadge.textContent = totalPulses > 99 ? '99+' : totalPulses;
            pulseBadge.style.display = totalPulses > 0 ? 'flex' : 'none';
        }
    }

    showPulseToast(message) {
        // Remover toasts existentes
        document.querySelectorAll('.pulse-toast').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = 'pulse-toast';
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        // Animar entrada
        setTimeout(() => toast.classList.add('show'), 100);
        
        // Remover após 3 segundos
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    async createMatchNotification(matchedUserId) {
        try {
            // Criar notificação de match
            const { error } = await this.supabase
                .from('user_notifications')
                .insert({
                    user_id: this.currentUser.id,
                    type: 'match',
                    title: '💝 Novo Match!',
                    message: 'Você tem um novo match! Clique para ver.',
                    related_user_id: matchedUserId,
                    priority: 'high',
                    created_at: new Date().toISOString()
                });

            if (error) console.warn('⚠️ Não foi possível criar notificação:', error);
            
        } catch (error) {
            console.warn('⚠️ Erro notificação match:', error);
        }
    }

    async waitForUserCards() {
        return new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 segundos máximo
            
            const checkCards = () => {
                const cards = document.querySelectorAll('.user-card');
                if (cards.length > 0) {
                    console.log(`✅ ${cards.length} cards encontrados`);
                    resolve();
                } else if (attempts < maxAttempts) {
                    attempts++;
                    setTimeout(checkCards, 100);
                } else {
                    console.warn('⚠️ Timeout esperando cards');
                    resolve();
                }
            };
            checkCards();
        });
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

    getGivenLikesCount() {
        return this.pulsesData.given.size;
    }

    getReceivedLikesCount() {
        return this.pulsesData.received.size;
    }

       addVipStyles() {
        if (document.getElementById('vip-styles')) return;
        
        const styles = document.createElement('style');
        styles.id = 'vip-styles';
        styles.textContent = `
            .vip-section {
                margin-bottom: 3rem;
                background: linear-gradient(135deg, #fff9f0, #ffebcd);
                border: 2px solid #ffd700;
                border-radius: 15px;
                padding: 1.5rem;
                box-shadow: 0 4px 20px rgba(255, 215, 0, 0.2);
            }
            
            .vip-section .section-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 1.5rem;
            }
            
            .vip-section h2 {
                color: #b8860b;
                font-size: 1.5rem;
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .vip-badge {
                background: linear-gradient(135deg, #ffd700, #ffa500);
                color: white;
                padding: 0.3rem 0.8rem;
                border-radius: 15px;
                font-size: 0.8rem;
                font-weight: bold;
            }
            
            .vip-cards-container {
                display: grid;
                grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
                gap: 1rem;
            }
            
            .vip-user-card {
                background: white;
                border: 2px solid #ffd700;
                border-radius: 12px;
                padding: 1rem;
                position: relative;
            }
            
            .vip-user-card::before {
                content: '⭐ VIP';
                position: absolute;
                top: 8px;
                right: 8px;
                background: linear-gradient(135deg, #ffd700, #ffa500);
                color: white;
                padding: 2px 6px;
                border-radius: 8px;
                font-size: 0.6rem;
                font-weight: bold;
            }
        `;
        document.head.appendChild(styles);
    }
}

// ==================== INICIALIZAÇÃO GLOBAL ====================
let pulseSystem = null;

async function initializePulseSystem(supabase, currentUser) {
    if (pulseSystem) {
        console.log('🔄 Pulse System já inicializado');
        return pulseSystem;
    }
    
    console.log('🎯 Inicializando Pulse System...');
    pulseSystem = new PulseSystem(supabase, currentUser);
    await pulseSystem.initialize();
    return pulseSystem;
}

// ==================== ESTILOS PULSE ====================
function addPulseStyles() {
    if (document.getElementById('pulse-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'pulse-styles';
    styles.textContent = `
        .pulse-btn {
            background: linear-gradient(135deg, #d1656d, #c44569);
            color: white;
            border: none;
            padding: 0.6rem 1rem;
            border-radius: 20px;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s ease;
            font-size: 0.85rem;
            min-width: 80px;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 0.3rem;
        }
        
        .pulse-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(209, 101, 109, 0.3);
        }
        
        .pulse-btn:active {
            transform: translateY(0);
        }
        
        .pulse-btn.pulse-active {
            background: linear-gradient(135deg, #667eea, #764ba2);
        }
        
        .pulse-btn.pulse-match {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            animation: pulse 2s infinite;
        }
        
        .pulse-toast {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%) translateY(100px);
            background: linear-gradient(135deg, #38a169, #2f855a);
            color: white;
            padding: 12px 24px;
            border-radius: 25px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 20px rgba(0,0,0,0.3);
            text-align: center;
            min-width: 200px;
            opacity: 0;
            transition: all 0.3s ease;
        }
        
        .pulse-toast.show {
            transform: translateX(-50%) translateY(0);
            opacity: 1;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 107, 107, 0.7); }
            50% { transform: scale(1.05); box-shadow: 0 0 0 10px rgba(255, 107, 107, 0); }
            100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(255, 107, 107, 0); }
        }
        
        /* Badge de notificações pulse */
        .pulse-badge {
            position: absolute;
            top: -5px;
            right: -5px;
            background: linear-gradient(135deg, #e53e3e, #c53030);
            color: white;
            border-radius: 50%;
            width: 18px;
            height: 18px;
            display: none;
            align-items: center;
            justify-content: center;
            font-size: 0.7rem;
            font-weight: bold;
            border: 2px solid white;
        }
    `;
    document.head.appendChild(styles);
}

// ==================== FUNÇÕES GLOBAIS ====================
window.PulseSystem = PulseSystem;
window.initializePulseSystem = initializePulseSystem;
window.pulseSystem = pulseSystem;

// Inicializar estilos quando o script carregar
addPulseStyles();

console.log('✅ Sistema Pulse COMPLETO carregado!');

// ==================== DETECTOR DE CARREGAMENTO ====================
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - Pulse System pronto');
    
    // Tentar inicialização automática se já tiver usuário
    if (window.supabase && window.currentUser) {
        setTimeout(() => {
            initializePulseSystem(window.supabase, window.currentUser)
                .then(system => {
                    console.log('✅ Pulse System auto-inicializado');
                    window.pulseSystem = system;
                })
                .catch(error => {
                    console.error('❌ Erro auto-inicialização:', error);
                });
        }, 1000);
    }
});