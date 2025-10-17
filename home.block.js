// home.block.js - Sistema de Bloqueio para Home
class HomeBlockSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.blockedUserIdsSet = new Set();
        this.currentBlockUserId = null;
        this.currentBlockUserName = null;
    }

    // ✅ INICIALIZAR SISTEMA
    async initialize() {
        try {
            console.log('⚡ Inicializando sistema de bloqueio...');
            
            // Carrega do cache local
            const cached = this.getCache();
            if (cached.size > 0) {
                this.blockedUserIdsSet = cached;
                console.log(`⚡ Cache carregado: ${this.blockedUserIdsSet.size} bloqueados`);
            }
            
            // Atualiza do banco
            await this.loadBlockedIds();
            console.log(`✅ Sistema de bloqueio pronto: ${this.blockedUserIdsSet.size} bloqueados`);
            
        } catch (error) {
            console.error('❌ Erro no sistema de bloqueio:', error);
        }
    }

    // ✅ CARREGAR BLOQUEADOS DO BANCO
    async loadBlockedIds() {
        try {
            const { data: blocks, error } = await this.supabase
                .from('user_blocks')
                .select('blocked_user_id')
                .eq('blocker_id', this.currentUser.id);

            if (error) throw error;

            const blockedIds = blocks.map(b => b.blocked_user_id);
            this.blockedUserIdsSet = new Set(blockedIds);
            this.setCache(this.blockedUserIdsSet);
            
            console.log(`✅ ${blockedIds.length} bloqueados carregados`);
            
        } catch (error) {
            console.error('❌ Erro ao carregar bloqueados:', error);
        }
    }

    // ✅ VERIFICAR SE USUÁRIO ESTÁ BLOQUEADO
    isUserBlocked(userId) {
        return this.blockedUserIdsSet.has(userId);
    }

    // ✅ ABRIR MODAL DE BLOQUEIO
    openBlockModal(userId, userName) {
        this.currentBlockUserId = userId;
        this.currentBlockUserName = userName;
        
        document.getElementById('blockUserName').textContent = userName;
        document.getElementById('blockModal').classList.add('show');
    }

    // ✅ FECHAR MODAL DE BLOQUEIO
    closeBlockModal() {
        document.getElementById('blockModal').classList.remove('show');
        this.currentBlockUserId = null;
        this.currentBlockUserName = null;
    }

    // ✅ CONFIRMAR BLOQUEIO (FUNÇÃO PRINCIPAL)
    async confirmBlock() {
        if (!this.currentBlockUserId) return;
        
        const userId = this.currentBlockUserId;
        const userName = this.currentBlockUserName;
        
        console.log('⚡ BLOQUEIO INICIADO:', userName);
        
        // 1. Fechar modal
        this.closeBlockModal();
        
        // 2. Remover da UI IMEDIATAMENTE
        this.removeUserCardImmediately(userId);
        
        // 3. Atualizar cache
        this.blockedUserIdsSet.add(userId);
        this.setCache(this.blockedUserIdsSet);
        
        // 4. Salvar no banco
        const success = await this.saveBlockToDatabase(userId);
        
        if (success) {
            this.showQuickToast(`✅ ${userName} bloqueado!`);
            
            // 5. Redirecionar após sucesso
            setTimeout(() => {
                window.location.href = 'blocks.html';
            }, 1000);
        } else {
            this.showQuickToast('⚠️ Bloqueado localmente (erro de rede)');
        }
    }

    // ✅ SALVAR BLOQUEIO NO BANCO
    async saveBlockToDatabase(userId) {
        try {
            const { error } = await this.supabase
                .from('user_blocks')
                .insert({
                    blocker_id: this.currentUser.id,
                    blocked_user_id: userId,
                    created_at: new Date().toISOString()
                });

            if (error) {
                if (error.code === '23505') {
                    return true; // Já existe
                }
                throw error;
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao salvar bloqueio:', error);
            return false;
        }
    }

    // ✅ REMOVER CARD IMEDIATAMENTE
    removeUserCardImmediately(userId) {
        console.log('🗑️ Removendo card:', userId);
        
        const cards = document.querySelectorAll(`[data-user-id="${userId}"]`);
        cards.forEach(card => {
            this.animateCardRemoval(card);
        });
    }

    // ✅ ANIMAÇÃO DE REMOÇÃO
    animateCardRemoval(card) {
        card.style.transition = 'all 0.3s ease';
        card.style.opacity = '0.5';
        card.style.transform = 'scale(0.95)';
        
        setTimeout(() => {
            card.style.opacity = '0';
            card.style.height = '0';
            card.style.margin = '0';
            card.style.padding = '0';
            card.style.overflow = 'hidden';
            
            setTimeout(() => {
                if (card.parentNode) {
                    card.remove();
                }
            }, 300);
        }, 150);
    }

    // ✅ CACHE LOCAL
    getCache() {
        const cached = localStorage.getItem(`blocked_cache_${this.currentUser?.id}`);
        return cached ? new Set(JSON.parse(cached)) : new Set();
    }

    setCache(blockedIds) {
        localStorage.setItem(`blocked_cache_${this.currentUser?.id}`, JSON.stringify([...blockedIds]));
    }

    // ✅ TOAST RÁPIDO
    showQuickToast(message) {
        document.querySelectorAll('.quick-toast').forEach(toast => toast.remove());
        
        const toast = document.createElement('div');
        toast.className = 'quick-toast';
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: #38a169; color: white; padding: 12px 20px; border-radius: 25px;
            font-size: 14px; font-weight: 600; z-index: 10000; opacity: 0;
            transition: opacity 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            text-align: center; min-width: 200px; max-width: 90%;
        `;
        
        document.body.appendChild(toast);
        setTimeout(() => toast.style.opacity = '1', 100);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // ✅ VERIFICAR SE FOI BLOQUEADO POR OUTRO USUÁRIO
    async checkIfBlockedByUser(userId) {
        try {
            const { data: blocks, error } = await this.supabase
                .from('user_blocks')
                .select('blocker_id')
                .eq('blocker_id', userId)
                .eq('blocked_user_id', this.currentUser.id)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return false;
                throw error;
            }
            return !!blocks;
        } catch (error) {
            return false;
        }
    }
}

// ✅ EXPORTAR PARA USO GLOBAL
window.HomeBlockSystem = HomeBlockSystem;