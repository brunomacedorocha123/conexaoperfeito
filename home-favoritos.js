// home-favoritos.js - SISTEMA COMPLETO DE FAVORITOS
console.log('🚀 home-favoritos.js carregado - aguardando inicialização...');

class FavoriteSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.isPremium = false;
        this.isInitialized = false;
        console.log('🎯 FavoriteSystem criado para:', currentUser?.email);
    }

    async initialize() {
        try {
            console.log('🔄 Inicializando sistema de favoritos...');
            
            // Verificar se temos tudo que precisamos
            if (!this.supabase) {
                throw new Error('❌ Supabase não disponível');
            }
            
            if (!this.currentUser?.id) {
                throw new Error('❌ Usuário não autenticado');
            }

            console.log('✅ Dependências verificadas - Supabase e usuário OK');
            
            // Testar conexão com o banco
            const { error: testError } = await this.supabase
                .from('profiles')
                .select('id')
                .eq('id', this.currentUser.id)
                .limit(1);

            if (testError) {
                throw new Error(`❌ Erro de conexão: ${testError.message}`);
            }

            console.log('✅ Conexão com banco de dados OK');
            
            // Carregar status premium
            await this.loadPremiumStatus();
            
            // Marcar como inicializado
            this.isInitialized = true;
            
            console.log('✅ Sistema de favoritos inicializado com SUCESSO!');
            console.log('👑 Status Premium:', this.isPremium);
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.isInitialized = false;
            return false;
        }
    }

    async loadPremiumStatus() {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', this.currentUser.id)
                .single();

            if (error) {
                console.warn('⚠️ Não foi possível verificar status premium:', error);
                this.isPremium = false;
                return;
            }

            this.isPremium = profile?.is_premium || false;
            console.log('👑 Status Premium carregado:', this.isPremium);
            
        } catch (error) {
            console.error('Erro ao carregar status premium:', error);
            this.isPremium = false;
        }
    }

    // 🎯 FUNÇÃO PRINCIPAL - ADICIONAR/REMOVER FAVORITO
    async toggleFavorite(userId, userCardElement = null) {
        console.log('❤️ toggleFavorite chamado para:', userId);
        
        try {
            // Validações de segurança
            if (!this.isInitialized) {
                throw new Error('Sistema de favoritos não inicializado');
            }

            if (!userId) {
                throw new Error('ID do usuário não fornecido');
            }

            if (userId === this.currentUser.id) {
                throw new Error('Não é possível favoritar a si mesmo');
            }

            console.log('🔍 Verificando se já é favorito...');
            
            // Verificar se já é favorito
            const { data: existingFavorite, error: checkError } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId)
                .single();

            // PGRST116 = "No rows found" - isso é normal
            if (checkError && checkError.code !== 'PGRST116') {
                console.error('❌ Erro ao verificar favorito:', checkError);
                throw checkError;
            }

            const isCurrentlyFavorite = !!existingFavorite;
            console.log('📊 Status atual:', isCurrentlyFavorite ? 'JÁ É FAVORITO' : 'NÃO É FAVORITO');

            let result;
            
            if (isCurrentlyFavorite) {
                result = await this.removeFavorite(userId, userCardElement);
            } else {
                result = await this.addFavorite(userId, userCardElement);
            }

            return result;

        } catch (error) {
            console.error('💥 ERRO em toggleFavorite:', error);
            this.showNotification('❌ ' + (error.message || 'Erro ao processar curtida'));
            throw error;
        }
    }

    async addFavorite(userId, userCardElement) {
        console.log('➕ ADICIONANDO favorito:', userId);
        
        try {
            const favoriteData = {
                user_id: this.currentUser.id,
                favorite_user_id: userId,
                created_at: new Date().toISOString()
            };

            console.log('📤 Enviando dados para Supabase:', favoriteData);

            const { data, error } = await this.supabase
                .from('user_favorites')
                .insert(favoriteData)
                .select()
                .single();

            if (error) {
                console.error('❌ Erro do Supabase ao adicionar:', error);
                throw error;
            }

            console.log('✅ Favorito adicionado com sucesso:', data);

            // Atualizar UI
            this.updateCardUI(userCardElement, true);
            
            // Atualizar outros cards se existirem
            if (window.updateFavoriteInCard) {
                window.updateFavoriteInCard(userId, true);
            }
            
            // Feedback para usuário
            if (this.isPremium) {
                this.showNotification('❤️ Adicionado à Lista VIP!');
            } else {
                this.showNotification('❤️ Curtida enviada!');
            }

            // Verificar match
            await this.checkMutualLike(userId);

            return true;

        } catch (error) {
            console.error('❌ Erro ao adicionar favorito:', error);
            this.showNotification('❌ Erro ao adicionar favorito');
            throw error;
        }
    }

    async removeFavorite(userId, userCardElement) {
        console.log('➖ REMOVENDO favorito:', userId);
        
        try {
            const { error } = await this.supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId);

            if (error) {
                console.error('❌ Erro ao remover favorito:', error);
                throw error;
            }

            console.log('✅ Favorito removido com sucesso');
            
            // Atualizar UI
            this.updateCardUI(userCardElement, false);
            
            // Atualizar outros cards se existirem
            if (window.updateFavoriteInCard) {
                window.updateFavoriteInCard(userId, false);
            }
            
            this.showNotification('💔 Curtida removida');

            return false;

        } catch (error) {
            console.error('❌ Erro ao remover favorito:', error);
            this.showNotification('❌ Erro ao remover favorito');
            throw error;
        }
    }

    async checkMutualLike(userId) {
        try {
            console.log('🔍 Verificando match com:', userId);

            const { data: mutualLike, error } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', userId)
                .eq('favorite_user_id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (mutualLike) {
                console.log('💝 MATCH DETECTADO!');
                this.showNotification('💝 Match! Vocês se curtiram!');
                await this.incrementPulseCount();
            }

        } catch (error) {
            console.error('Erro ao verificar match:', error);
        }
    }

    async incrementPulseCount() {
        try {
            const { data: existingPulse } = await this.supabase
                .from('user_pulses')
                .select('*')
                .eq('user_id', this.currentUser.id)
                .single();

            if (existingPulse) {
                await this.supabase
                    .from('user_pulses')
                    .update({ 
                        pulse_count: existingPulse.pulse_count + 1,
                        last_updated: new Date().toISOString()
                    })
                    .eq('user_id', this.currentUser.id);
            } else {
                await this.supabase
                    .from('user_pulses')
                    .insert({
                        user_id: this.currentUser.id,
                        pulse_count: 1,
                        last_updated: new Date().toISOString()
                    });
            }

            console.log('📈 Pulse count atualizado');

        } catch (error) {
            console.error('Erro ao incrementar pulse:', error);
        }
    }

    updateCardUI(cardElement, isFavorite) {
        if (!cardElement) {
            console.log('ℹ️ Nenhum card element fornecido para atualizar UI');
            return;
        }

        const favoriteBtn = cardElement.querySelector('.favorite-btn');
        if (favoriteBtn) {
            if (isFavorite) {
                favoriteBtn.innerHTML = '❤️';
                favoriteBtn.title = 'Remover dos favoritos';
                favoriteBtn.classList.add('favorited');
                console.log('🎨 UI atualizada: FAVORITADO');
            } else {
                favoriteBtn.innerHTML = '🤍';
                favoriteBtn.title = 'Adicionar aos favoritos';
                favoriteBtn.classList.remove('favorited');
                console.log('🎨 UI atualizada: NÃO FAVORITADO');
            }
        } else {
            console.warn('❌ Botão de favorito não encontrado');
        }
    }

    async isUserFavorite(userId) {
        try {
            const { data: favorite, error } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            return !!favorite;

        } catch (error) {
            console.error('Erro ao verificar favorito:', error);
            return false;
        }
    }

    showNotification(message) {
        if (window.showQuickToast) {
            window.showQuickToast(message);
        } else {
            // Fallback de toast
            const toast = document.createElement('div');
            toast.style.cssText = `
                position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
                background: #333; color: white; padding: 12px 24px; border-radius: 25px;
                font-size: 14px; font-weight: 600; z-index: 10000; opacity: 0;
                transition: opacity 0.3s; box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            `;
            toast.textContent = message;
            document.body.appendChild(toast);
            
            setTimeout(() => toast.style.opacity = '1', 100);
            setTimeout(() => {
                toast.style.opacity = '0';
                setTimeout(() => toast.remove(), 300);
            }, 3000);
        }
    }
}

// ==================== SISTEMA DE INICIALIZAÇÃO INTELIGENTE ====================

async function initializeFavoriteSystem() {
    console.log('🔧 Iniciando sistema de favoritos...');
    
    let tentativas = 0;
    const maxTentativas = 25; // 12.5 segundos
    
    while (tentativas < maxTentativas) {
        if (window.supabase && window.currentUser) {
            console.log('🚀 Dependências encontradas - criando FavoriteSystem...');
            
            try {
                window.favoriteSystem = new FavoriteSystem(window.supabase, window.currentUser);
                const success = await window.favoriteSystem.initialize();
                
                if (success) {
                    console.log('✅ Sistema de favoritos inicializado com SUCESSO!');
                    
                    // Disparar evento de inicialização
                    window.dispatchEvent(new CustomEvent('favoriteSystemReady'));
                    
                    return true;
                } else {
                    console.error('❌ Falha na inicialização do FavoriteSystem');
                    return false;
                }
            } catch (error) {
                console.error('❌ Erro na inicialização:', error);
                return false;
            }
        }
        
        console.log('⏳ Aguardando supabase e currentUser...', tentativas + 1);
        await new Promise(resolve => setTimeout(resolve, 500));
        tentativas++;
    }
    
    console.error('💥 TIMEOUT: Não foi possível inicializar sistema de favoritos');
    return false;
}

// ==================== FUNÇÃO GLOBAL PRINCIPAL ====================

window.toggleFavorite = async function(userId, event) {
    console.log('🎯 toggleFavorite GLOBAL chamado para:', userId);
    
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('📊 Estado do sistema:', {
        favoriteSystem: !!window.favoriteSystem,
        isInitialized: window.favoriteSystem?.isInitialized,
        supabase: !!window.supabase,
        currentUser: !!window.currentUser
    });
    
    if (window.favoriteSystem && window.favoriteSystem.isInitialized) {
        try {
            const cardElement = event ? event.target.closest('.user-card') : null;
            const result = await window.favoriteSystem.toggleFavorite(userId, cardElement);
            return result;
        } catch (error) {
            console.error('❌ Erro no toggleFavorite:', error);
            showQuickToast('❌ Erro ao processar curtida');
            return false;
        }
    } else {
        console.error('❌ favoriteSystem não disponível ou não inicializado');
        showQuickToast('⚠️ Sistema de favoritos não carregado. Aguarde...');
        
        // Tentar inicializar novamente
        setTimeout(() => {
            initializeFavoriteSystem();
        }, 1000);
        return false;
    }
};

// Função para Lista VIP
window.goToVipList = function() {
    if (window.favoriteSystem && window.favoriteSystem.isPremium) {
        window.location.href = 'lista-vip.html';
    } else {
        showQuickToast('⭐ Torne-se Premium para acessar a Lista VIP!');
        window.location.href = 'princing.html';
    }
};

// ==================== INICIALIZAÇÃO AUTOMÁTICA ====================

// Estratégia 1: Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - iniciando sistema de favoritos...');
    initializeFavoriteSystem();
});

// Estratégia 2: Inicializar quando window estiver carregada
window.addEventListener('load', function() {
    console.log('🔄 Window loaded - verificando sistema...');
    if (!window.favoriteSystem || !window.favoriteSystem.isInitialized) {
        console.log('🔄 Tentando inicializar novamente...');
        setTimeout(initializeFavoriteSystem, 2000);
    }
});

// Estratégia 3: Verificar periodicamente se as dependências ficaram disponíveis
let dependencyCheckInterval = setInterval(() => {
    if (window.supabase && window.currentUser && (!window.favoriteSystem || !window.favoriteSystem.isInitialized)) {
        console.log('🔍 Dependências disponíveis - inicializando sistema...');
        initializeFavoriteSystem();
    }
}, 1000);

// Parar a verificação após 30 segundos
setTimeout(() => {
    clearInterval(dependencyCheckInterval);
}, 30000);

// ==================== FUNÇÕES UTILITÁRIAS ====================

// Debug helper
window.debugFavoriteSystem = function() {
    console.log('🔍 DEBUG - Sistema de Favoritos:');
    console.log('- favoriteSystem:', window.favoriteSystem);
    console.log('- isInitialized:', window.favoriteSystem?.isInitialized);
    console.log('- isPremium:', window.favoriteSystem?.isPremium);
    console.log('- supabase:', window.supabase);
    console.log('- currentUser:', window.currentUser);
    console.log('- currentUser ID:', window.currentUser?.id);
    console.log('- toggleFavorite:', window.toggleFavorite);
};

// Função global de toast (fallback)
if (typeof showQuickToast === 'undefined') {
    window.showQuickToast = function(message) {
        console.log('🔔 TOAST:', message);
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed; bottom: 20px; left: 50%; transform: translateX(-50%);
            background: #38a169; color: white; padding: 12px 20px; border-radius: 25px;
            font-size: 14px; font-weight: 600; z-index: 10000; opacity: 0;
            transition: opacity 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            text-align: center; min-width: 200px; max-width: 90%;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        
        setTimeout(() => toast.style.opacity = '1', 100);
        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    };
}

console.log('✅ home-favoritos.js CARREGADO - sistema de inicialização ativo!');