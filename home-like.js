// ==================== SISTEMA PULSE/CURTIR ====================
class PulseSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.userProfile = null;
        this.pulsesData = {
            given: new Set(),    // IDs de quem eu curti
            received: new Set(), // IDs de quem me curtiu  
            matches: new Set()   // IDs de matches mútuos
        };
    }

    // ==================== INICIALIZAÇÃO ====================
    async initialize() {
        try {
            console.log('🎯 Iniciando Sistema Pulse...');
            
            if (!this.currentUser) {
                console.error('❌ Usuário não autenticado');
                return;
            }

            // 1. Carregar perfil do usuário
            await this.loadUserProfile();
            
            // 2. Carregar dados de pulses
            await this.loadPulsesData();
            
            // 3. Integrar com cards existentes
            await this.integrateWithUserCards();
            
            // 4. Atualizar contadores
            this.updatePulseCounters();
            
            // ✅ DEBUG: Verificar comunicação com vip_list
            await this.debugVipListCommunication();
            
            console.log('✅ Sistema Pulse inicializado!');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar Sistema Pulse:', error);
        }
    }

    // ==================== CARREGAR DADOS ====================
    async loadUserProfile() {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', this.currentUser.id)
                .single();

            if (error) throw error;
            this.userProfile = profile;
            
        } catch (error) {
            console.error('Erro ao carregar perfil:', error);
        }
    }

    async loadPulsesData() {
        try {
            // Carregar pulses que EU dei
            const { data: givenPulses, error: givenError } = await this.supabase
                .from('pulses')
                .select('user_to_id')
                .eq('user_from_id', this.currentUser.id)
                .eq('status', 'active');

            if (!givenError && givenPulses) {
                givenPulses.forEach(pulse => {
                    this.pulsesData.given.add(pulse.user_to_id);
                });
            }

            // Carregar pulses que EU recebi
            const { data: receivedPulses, error: receivedError } = await this.supabase
                .from('pulses')
                .select('user_from_id')
                .eq('user_to_id', this.currentUser.id)
                .eq('status', 'active');

            if (!receivedError && receivedPulses) {
                receivedPulses.forEach(pulse => {
                    this.pulsesData.received.add(pulse.user_from_id);
                    
                    // Verificar se é match mútuo
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
            console.error('Erro ao carregar pulses:', error);
        }
    }

    // ==================== DEBUG COMUNICAÇÃO VIP_LIST ====================
    async debugVipListCommunication() {
        console.group('🐛 DEBUG COMUNICAÇÃO VIP_LIST');
        
        try {
            // Testar se a tabela vip_list existe e está acessível
            const { data: testData, error: testError } = await this.supabase
                .from('vip_list')
                .select('count')
                .limit(1)
                .single();

            if (testError) {
                console.error('❌ Tabela vip_list inacessível:', testError);
                console.log('💡 Solução: Execute o SQL de criação da tabela vip_list');
            } else {
                console.log('✅ Tabela vip_list acessível');
            }

            // Verificar quantos usuários estão na lista VIP atual
            const { data: currentVip, error: countError } = await this.supabase
                .from('vip_list')
                .select('vip_user_id', { count: 'exact' })
                .eq('user_id', this.currentUser.id);

            if (countError) {
                console.error('❌ Erro ao contar VIP:', countError);
            } else {
                console.log(`📊 Usuário tem ${currentVip?.length || 0} pessoas na lista VIP`);
            }

            // Verificar pulses ativos
            const { data: receivedPulses, error: pulsesError } = await this.supabase
                .from('pulses')
                .select('user_from_id', { count: 'exact' })
                .eq('user_to_id', this.currentUser.id)
                .eq('status', 'active');

            if (pulsesError) {
                console.error('❌ Erro ao contar pulses:', pulsesError);
            } else {
                console.log(`📈 Usuário recebeu ${receivedPulses?.length || 0} curtidas`);
            }

        } catch (error) {
            console.error('❌ Erro no debug:', error);
        }
        
        console.groupEnd();
    }

    // ==================== INTEGRAÇÃO COM CARDS ====================
    async integrateWithUserCards() {
        // Aguardar cards carregarem
        await this.waitForUserCards();
        
        const userCards = document.querySelectorAll('.user-card');
        console.log(`🎴 Encontrados ${userCards.length} cards para integrar`);
        
        userCards.forEach(card => {
            this.addPulseButtonToCard(card);
            this.updateCardPulseStatus(card);
        });

        // Observar novos cards dinamicamente
        this.observeNewCards();
    }

    async waitForUserCards() {
        return new Promise((resolve) => {
            const checkCards = () => {
                const cards = document.querySelectorAll('.user-card');
                if (cards.length > 0) {
                    resolve();
                } else {
                    setTimeout(checkCards, 100);
                }
            };
            checkCards();
        });
    }

    observeNewCards() {
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                mutation.addedNodes.forEach((node) => {
                    if (node.nodeType === 1 && node.classList?.contains('user-card')) {
                        this.addPulseButtonToCard(node);
                        this.updateCardPulseStatus(node);
                    }
                    
                    // Verificar filhos adicionados
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

    // ==================== BOTÃO PULSE/CURTIR ====================
    addPulseButtonToCard(card) {
        // Verificar se já tem botão pulse
        if (card.querySelector('.pulse-btn')) return;

        const userId = card.getAttribute('data-user-id');
        if (!userId) {
            console.warn('Card sem data-user-id:', card);
            return;
        }

        const actionsContainer = card.querySelector('.user-card-actions');
        if (!actionsContainer) return;

        // Criar botão pulse
        const pulseBtn = document.createElement('button');
        pulseBtn.className = 'pulse-btn';
        pulseBtn.innerHTML = '💗 Pulse';
        pulseBtn.setAttribute('data-user-id', userId);
        
        // Inserir antes dos outros botões
        actionsContainer.insertBefore(pulseBtn, actionsContainer.firstChild);
        
        // Adicionar evento
        pulseBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.handlePulseClick(userId, pulseBtn);
        });

        // Atualizar estado inicial do botão
        this.updatePulseButtonState(pulseBtn, userId);
    }

    updatePulseButtonState(button, userId) {
        const isGiven = this.pulsesData.given.has(userId);
        const isMatch = this.pulsesData.matches.has(userId);
        const isReceived = this.pulsesData.received.has(userId);
        const isPremium = this.userProfile?.is_premium;

        button.classList.remove('pulse-active', 'pulse-match', 'pulse-received');
        
        if (isMatch) {
            // MATCH - Ambos curtiram
            button.innerHTML = '💝 Match!';
            button.classList.add('pulse-match');
            button.title = 'Vocês têm um match!';
        } 
        else if (isGiven) {
            // JÁ CURTIU - Você curtiu esta pessoa
            button.innerHTML = '💗 Curtido';
            button.classList.add('pulse-active');
            button.title = 'Você já curtiu esta pessoa';
        }
        else if (isReceived && isPremium) {
            // TE CURTIU - Apenas Premium vê
            button.innerHTML = '💖 Te curtiu!';
            button.classList.add('pulse-received');
            button.title = 'Esta pessoa te curtiu!';
        }
        else {
            // NÃO CURTIU - Estado normal
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

        // Adicionar indicador visual no card (opcional)
        this.addCardVisualIndicators(card, userId);
    }

    addCardVisualIndicators(card, userId) {
        // Remover indicadores existentes
        card.querySelectorAll('.pulse-indicator').forEach(ind => ind.remove());

        const isMatch = this.pulsesData.matches.has(userId);
        const isGiven = this.pulsesData.given.has(userId);
        const isReceived = this.pulsesData.received.has(userId);
        const isPremium = this.userProfile?.is_premium;

        if (isMatch) {
            // Badge de match
            const matchBadge = document.createElement('div');
            matchBadge.className = 'pulse-indicator match-badge';
            matchBadge.innerHTML = '💝 Match';
            matchBadge.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: linear-gradient(135deg, #ff6b6b, #ee5a24);
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: bold;
                z-index: 10;
            `;
            card.style.position = 'relative';
            card.appendChild(matchBadge);
        }
        else if (isReceived && isPremium) {
            // Badge para "te curtiu" (apenas Premium)
            const likedBadge = document.createElement('div');
            likedBadge.className = 'pulse-indicator liked-badge';
            likedBadge.innerHTML = '💖 Te curtiu';
            likedBadge.style.cssText = `
                position: absolute;
                top: 10px;
                right: 10px;
                background: linear-gradient(135deg, #d1656d, #c44569);
                color: white;
                padding: 4px 8px;
                border-radius: 12px;
                font-size: 0.7rem;
                font-weight: bold;
                z-index: 10;
            `;
            card.style.position = 'relative';
            card.appendChild(likedBadge);
        }
    }

    // ==================== LÓGICA DE CURTIR ====================
    async handlePulseClick(userId, button) {
        try {
            const isGiven = this.pulsesData.given.has(userId);
            
            if (isGiven) {
                // Descurtir - revogar pulse
                await this.revokePulse(userId);
                this.pulsesData.given.delete(userId);
                
                // Remover de matches se existia
                if (this.pulsesData.matches.has(userId)) {
                    this.pulsesData.matches.delete(userId);
                }
                
                // Remover da lista VIP também
                await this.removeFromVipList(userId);
                
                this.showPulseToast('Curtida removida', 'info');
            } else {
                // Curtir - criar pulse
                await this.createPulse(userId);
                this.pulsesData.given.add(userId);
                
                // ✅ SALVAR NA LISTA VIP (CORREÇÃO CRÍTICA)
                await this.saveLikeToVipList(userId);
                
                // Verificar se agora é match
                if (this.pulsesData.received.has(userId)) {
                    this.pulsesData.matches.add(userId);
                    this.showPulseToast('💝 Novo match!', 'success');
                } else {
                    this.showPulseToast('Curtida enviada!', 'success');
                }
            }

            // Atualizar interface
            this.updatePulseButtonState(button, userId);
            this.updateCardPulseStatus(button.closest('.user-card'));
            this.updatePulseCounters();

        } catch (error) {
            console.error('Erro ao processar pulse:', error);
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
                // Pulse já existe, apenas reativar
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

    // ==================== ✅ FUNÇÃO CRÍTICA: SALVAR NA LISTA VIP ====================
    async saveLikeToVipList(targetUserId) {
        try {
            console.log('💖 Salvando like na lista VIP:', targetUserId);
            
            // ✅ VERIFICAR SE JÁ EXISTE NA LISTA VIP
            const { data: existingVip, error: checkError } = await this.supabase
                .from('vip_list')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('vip_user_id', targetUserId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('❌ Erro ao verificar lista VIP:', checkError);
            }

            // ✅ SE JÁ EXISTIR, NÃO INSERIR NOVAMENTE
            if (existingVip) {
                console.log('ℹ️ Usuário já está na lista VIP');
                return;
            }

            // ✅ INSERIR na tabela vip_list
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
                    console.log('ℹ️ Usuário já está na lista VIP (duplicado)');
                } else {
                    console.error('❌ Erro ao salvar na lista VIP:', vipError);
                    // Tentar criar tabela se não existir
                    await this.createVipListTable();
                }
            } else {
                console.log('✅ Like salvo na lista VIP com sucesso!', vipData);
            }

        } catch (error) {
            console.error('❌ Erro crítico ao salvar na lista VIP:', error);
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
            console.error('❌ Erro ao remover da lista VIP:', error);
        }
    }

    async createVipListTable() {
        console.log('🔄 Tentando criar tabela vip_list...');
        // Esta função seria chamada apenas se a tabela não existir
        // Em produção, a tabela deve ser criada via SQL
    }

    // ==================== CONTADORES E STATS ====================
    updatePulseCounters() {
        // Atualizar contador de matches (apenas para Premium)
        if (this.userProfile?.is_premium) {
            const matchesCount = this.pulsesData.matches.size;
            this.updateMatchesCounter(matchesCount);
        }

        // Atualizar contador de pulses recebidos (apenas para Premium)
        if (this.userProfile?.is_premium) {
            const receivedCount = this.pulsesData.received.size;
            this.updateReceivedPulsesCounter(receivedCount);
        }
    }

    updateMatchesCounter(count) {
        // Atualizar em algum elemento da UI
        const matchesElement = document.getElementById('matchesCount');
        if (matchesElement) {
            matchesElement.textContent = count;
        }
        
        // Atualizar no menu se existir
        const menuMatches = document.querySelector('[data-pulse-matches]');
        if (menuMatches) {
            menuMatches.textContent = count;
        }
    }

    updateReceivedPulsesCounter(count) {
        // Atualizar contador de "quem te curtiu"
        const receivedElement = document.getElementById('receivedPulsesCount');
        if (receivedElement) {
            receivedElement.textContent = count;
        }
    }

    // ==================== LISTA VIP (PREMIUM) ====================
    async getVipList() {
        if (!this.userProfile?.is_premium) {
            this.showPulseToast('Recurso exclusivo para Premium', 'warning');
            return [];
        }

        try {
            console.log('📋 Buscando lista VIP...');
            
            // ✅ BUSCAR DA TABELA VIP_LIST
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

            if (error) {
                console.error('❌ Erro ao carregar lista VIP:', error);
                
                // ✅ FALLBACK: Se vip_list não existir, usar pulses
                console.log('🔄 Tentando fallback com tabela pulses...');
                return await this.getVipListFromPulses();
            }

            console.log(`✅ ${vipUsers?.length || 0} usuários na lista VIP`);

            // Formatar dados para compatibilidade
            const formattedVipUsers = vipUsers?.map(vip => ({
                user_from_id: vip.vip_user_id,
                created_at: vip.created_at,
                profiles: vip.profiles
            })) || [];

            return formattedVipUsers;

        } catch (error) {
            console.error('❌ Erro ao carregar lista VIP:', error);
            return [];
        }
    }

    // ✅ NOVO MÉTODO: Fallback para buscar de pulses
    async getVipListFromPulses() {
        try {
            const { data: pulses, error } = await this.supabase
                .from('pulses')
                .select(`
                    user_from_id,
                    created_at,
                    profiles:user_from_id (
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
                .eq('user_to_id', this.currentUser.id)
                .eq('status', 'active')
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log(`✅ ${pulses?.length || 0} usuários via fallback pulses`);
            return pulses || [];

        } catch (error) {
            console.error('❌ Erro no fallback pulses:', error);
            return [];
        }
    }

    // ==================== CARDS ESPECIAIS NA HOME ====================
    async addVipCardsToHome() {
        if (!this.userProfile?.is_premium) return;

        try {
            const vipUsers = await this.getVipList();
            if (vipUsers.length === 0) return;

            console.log(`⭐ Adicionando ${vipUsers.length} cards VIP na home`);

            // Encontrar seção "Conheça Novas Pessoas"
            const usersSection = document.querySelector('.users-section');
            if (!usersSection) return;

            // Criar seção especial para "Quem te curtiu"
            this.createVipUsersSection(usersSection, vipUsers);

        } catch (error) {
            console.error('❌ Erro ao adicionar cards VIP:', error);
        }
    }

    createVipUsersSection(container, vipUsers) {
        // Verificar se já existe seção VIP
        if (document.getElementById('vipUsersSection')) {
            // ✅ CORREÇÃO: Se já existe, apenas atualizar o conteúdo
            this.addVipUserCards(vipUsers);
            return;
        }

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

        // Inserir antes da seção principal
        container.parentNode.insertBefore(vipSection, container);

        // ✅ CORREÇÃO: Adicionar cards após a seção ser criada
        setTimeout(() => {
            this.addVipUserCards(vipUsers);
        }, 100);
    }

    async addVipUserCards(vipUsers) {
        const vipGrid = document.getElementById('vipUsersGrid');
        if (!vipGrid) return;

        vipGrid.innerHTML = '<div class="loading"><div class="spinner"></div><p>Carregando lista VIP...</p></div>';

        // ✅ CORREÇÃO: Usar DocumentFragment para melhor performance
        const fragment = document.createDocumentFragment();
        
        for (const vip of vipUsers) {
            try {
                const cardHtml = await this.createVipUserCard(vip);
                if (cardHtml) {
                    const tempDiv = document.createElement('div');
                    tempDiv.innerHTML = cardHtml;
                    if (tempDiv.firstElementChild) {
                        fragment.appendChild(tempDiv.firstElementChild);
                    }
                }
            } catch (error) {
                console.error('Erro ao criar card VIP:', error);
            }
        }

        // ✅ CORREÇÃO: Limpar e adicionar todos de uma vez
        vipGrid.innerHTML = '';
        vipGrid.appendChild(fragment);

        // ✅ CORREÇÃO: Re-aplicar event listeners após inserir no DOM
        this.reapplyEventListeners();
    }

    // ✅ NOVO MÉTODO: Re-aplicar event listeners
    reapplyEventListeners() {
        // Re-aplicar listeners para botões de mensagem e perfil
        document.querySelectorAll('.vip-card .btn-primary').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                const userId = this.closest('.user-card').getAttribute('data-user-id');
                if (userId && window.sendMessage) {
                    sendMessage(userId, e);
                }
            };
        });

        document.querySelectorAll('.vip-card .btn-secondary').forEach(btn => {
            btn.onclick = function(e) {
                e.stopPropagation();
                const userId = this.closest('.user-card').getAttribute('data-user-id');
                if (userId && window.viewProfile) {
                    viewProfile(userId, e);
                }
            };
        });
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

            // ✅ CORREÇÃO CRÍTICA: Carregar avatar corretamente
            const avatarHtml = await this.createAvatarHtml(user, nickname);

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

    // ✅ NOVO MÉTODO: Criar HTML do avatar com carregamento correto
    async createAvatarHtml(user, nickname) {
        try {
            const initial = nickname.charAt(0).toUpperCase();
            
            if (!user.avatar_url) {
                return `
                    <div class="user-card-avatar">
                        <div class="user-card-avatar-fallback">${initial}</div>
                    </div>
                `;
            }

            // ✅ CORREÇÃO: Usar getPublicUrl do Supabase
            const photoUrl = await this.loadUserPhoto(user.avatar_url);
            
            if (photoUrl) {
                return `
                    <div class="user-card-avatar">
                        <img class="user-card-avatar-img" src="${photoUrl}" alt="${nickname}" 
                             onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                        <div class="user-card-avatar-fallback" style="display: none;">${initial}</div>
                    </div>
                `;
            } else {
                return `
                    <div class="user-card-avatar">
                        <div class="user-card-avatar-fallback">${initial}</div>
                    </div>
                `;
            }
            
        } catch (error) {
            console.error('Erro ao criar avatar:', error);
            return `
                <div class="user-card-avatar">
                    <div class="user-card-avatar-fallback">${nickname.charAt(0).toUpperCase()}</div>
                </div>
            `;
        }
    }

    // ✅ NOVO MÉTODO: Carregar foto do usuário (igual ao home.html)
    async loadUserPhoto(avatarUrl) {
        try {
            if (!avatarUrl) return null;
            
            // ✅ CORREÇÃO: Usar getPublicUrl corretamente
            const { data } = this.supabase.storage.from('avatars').getPublicUrl(avatarUrl);
            const photoUrl = data?.publicUrl;
            
            if (!photoUrl) return null;
            
            // ✅ VERIFICAR se a imagem é acessível
            return new Promise((resolve) => {
                const img = new Image();
                img.onload = () => resolve(photoUrl);
                img.onerror = () => {
                    console.warn('❌ Imagem não carrega:', photoUrl);
                    resolve(null);
                };
                img.src = photoUrl;
            });
            
        } catch (error) {
            console.error('❌ Erro ao carregar foto:', error);
            return null;
        }
    }

    // ==================== UTILITÁRIOS ====================
    showPulseToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            background: ${type === 'success' ? '#38a169' : type === 'error' ? '#e53e3e' : '#d1656d'};
            color: white;
            padding: 12px 20px;
            border-radius: 25px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        `;
        toast.textContent = message;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transition = 'opacity 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ==================== FUNÇÕES AUXILIARES ====================
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

    // ==================== GETTERS PÚBLICOS ====================
    getGivenPulsesCount() {
        return this.pulsesData.given.size;
    }

    getReceivedPulsesCount() {
        return this.pulsesData.received.size;
    }

    getMatchesCount() {
        return this.pulsesData.matches.size;
    }

    isUserLiked(userId) {
        return this.pulsesData.given.has(userId);
    }

    isMatch(userId) {
        return this.pulsesData.matches.has(userId);
    }
}

// ==================== INICIALIZAÇÃO GLOBAL ====================
let pulseSystem = null;

async function initializePulseSystem(supabase, currentUser) {
    if (pulseSystem) return pulseSystem;
    
    pulseSystem = new PulseSystem(supabase, currentUser);
    await pulseSystem.initialize();
    
    return pulseSystem;
}

// ==================== ESTILOS CSS DINÂMICOS ====================
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
        }
        
        .pulse-btn:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(209, 101, 109, 0.4);
        }
        
        .pulse-btn.pulse-active {
            background: linear-gradient(135deg, #667eea, #764ba2);
        }
        
        .pulse-btn.pulse-match {
            background: linear-gradient(135deg, #ff6b6b, #ee5a24);
            animation: pulse 2s infinite;
        }
        
        .pulse-btn.pulse-received {
            background: linear-gradient(135deg, #f093fb, #f5576c);
        }
        
        .vip-card {
            position: relative;
            border: 2px solid #ffd700 !important;
            background: linear-gradient(135deg, #fffaf0, #fff9c4) !important;
        }
        
        .vip-card::before {
            content: '⭐ VIP';
            position: absolute;
            top: -10px;
            right: -10px;
            background: linear-gradient(135deg, #ffd700, #ff6b00);
            color: white;
            padding: 4px 8px;
            border-radius: 12px;
            font-size: 0.7rem;
            font-weight: bold;
            z-index: 10;
        }
        
        @keyframes pulse {
            0% { transform: scale(1); }
            50% { transform: scale(1.05); }
            100% { transform: scale(1); }
        }
        
        .pulse-badge {
            background: linear-gradient(135deg, #d1656d, #c44569);
            color: white;
            padding: 0.3rem 0.8rem;
            border-radius: 15px;
            font-size: 0.8rem;
            font-weight: bold;
        }
    `;
    
    document.head.appendChild(styles);
}

// ==================== EXPORTAR PARA USO GLOBAL ====================
window.PulseSystem = PulseSystem;
window.initializePulseSystem = initializePulseSystem;

// Inicializar estilos
addPulseStyles();

console.log('✅ Sistema Pulse carregado!');