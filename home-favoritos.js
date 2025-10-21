// home-favoritos.js - SISTEMA COMPLETO CORRIGIDO
console.log('🚀 home-favoritos.js carregado - aguardando inicialização...');

class FavoriteSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.isPremium = false;
        this.isInitialized = false;
        console.log('🎯 FavoriteSystem criado para usuário:', currentUser?.id);
    }

    async initialize() {
        try {
            console.log('🔄 Inicializando sistema de favoritos...');
            
            // Verificar se temos as dependências necessárias
            if (!this.supabase || !this.currentUser) {
                throw new Error('Supabase ou currentUser não disponíveis');
            }
            
            await this.checkPremiumStatus();
            this.isInitialized = true;
            console.log('✅ Sistema de favoritos pronto!');
            return true;
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            this.isInitialized = false;
            return false;
        }
    }

    async checkPremiumStatus() {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', this.currentUser.id)
                .single();

            if (!error && profile) {
                this.isPremium = profile.is_premium || false;
                console.log('👑 Status Premium:', this.isPremium);
            }
        } catch (error) {
            console.error('Erro ao verificar premium:', error);
            this.isPremium = false;
        }
    }

    // ❤️ FUNÇÃO PRINCIPAL DE CURTIR - CORRIGIDA
    async toggleFavorite(userId, userCardElement = null) {
        try {
            console.log('❤️ Processando curtida para:', userId);
            
            if (!this.isInitialized) {
                throw new Error('Sistema de favoritos não inicializado');
            }

            // Verificar se já é favorito
            const { data: existingFavorite, error: checkError } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('❌ Erro ao verificar favorito:', checkError);
                throw checkError;
            }

            const isCurrentlyFavorite = !!existingFavorite;
            console.log('📊 Status atual:', isCurrentlyFavorite ? 'FAVORITO' : 'NÃO FAVORITO');

            if (isCurrentlyFavorite) {
                await this.removeFavorite(userId, userCardElement);
            } else {
                await this.addFavorite(userId, userCardElement);
            }

            return !isCurrentlyFavorite;

        } catch (error) {
            console.error('💥 ERRO CRÍTICO em toggleFavorite:', error);
            this.showToast('❌ Erro ao processar curtida');
            throw error;
        }
    }

    async addFavorite(userId, userCardElement) {
        try {
            console.log('➕ ADICIONANDO favorito:', userId);
            
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
            
            // Atualizar outros cards
            if (window.updateFavoriteInCard) {
                window.updateFavoriteInCard(userId, true);
            }
            
            // Feedback
            if (this.isPremium) {
                this.showToast('❤️ Adicionado à Lista VIP!');
            } else {
                this.showToast('❤️ Curtida enviada!');
            }

            // Verificar match
            await this.checkMutualLike(userId);

        } catch (error) {
            console.error('❌ Erro ao adicionar favorito:', error);
            throw error;
        }
    }

    async removeFavorite(userId, userCardElement) {
        try {
            console.log('➖ REMOVENDO favorito:', userId);

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
            
            // Atualizar outros cards
            if (window.updateFavoriteInCard) {
                window.updateFavoriteInCard(userId, false);
            }
            
            this.showToast('💔 Curtida removida');

        } catch (error) {
            console.error('❌ Erro ao remover favorito:', error);
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
                this.showToast('💝 Match! Vocês se curtiram!');
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

    showToast(message) {
        // Usar a função global se existir, senão criar uma
        if (window.showQuickToast) {
            window.showQuickToast(message);
        } else {
            console.log('🔔 TOAST:', message);
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

let initializationAttempts = 0;
const MAX_INITIALIZATION_ATTEMPTS = 25; // 12.5 segundos

async function initializeFavoriteSystem() {
    console.log('🔧 Iniciando sistema de favoritos...');
    
    // Se já estiver inicializado, retornar
    if (window.favoriteSystem && window.favoriteSystem.isInitialized) {
        console.log('✅ Sistema de favoritos já inicializado');
        return true;
    }
    
    // Verificar se temos as dependências necessárias
    if (!window.supabase || !window.currentUser) {
        console.log('⏳ Aguardando supabase e currentUser...');
        
        if (initializationAttempts < MAX_INITIALIZATION_ATTEMPTS) {
            initializationAttempts++;
            setTimeout(initializeFavoriteSystem, 500);
            return false;
        } else {
            console.error('💥 TIMEOUT: Não foi possível inicializar sistema de favoritos');
            showQuickToast('⚠️ Sistema de favoritos não carregou');
            return false;
        }
    }
    
    try {
        console.log('🚀 Inicializando FavoriteSystem...');
        window.favoriteSystem = new FavoriteSystem(window.supabase, window.currentUser);
        const success = await window.favoriteSystem.initialize();
        
        if (success) {
            console.log('✅ Sistema de favoritos inicializado com SUCESSO!');
            
            // Disparar evento de inicialização para outros sistemas
            window.dispatchEvent(new CustomEvent('favoriteSystemReady'));
            
            // Notificar usuário
            if (window.showQuickToast) {
                window.showQuickToast('✅ Sistema de favoritos pronto!');
            }
            
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

// ==================== FUNÇÃO GLOBAL PRINCIPAL COM FALLBACKS ====================

window.toggleFavorite = async function(userId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('🎯 toggleFavorite CHAMADO para:', userId);
    console.log('📊 Estado do sistema:', {
        favoriteSystem: !!window.favoriteSystem,
        isInitialized: window.favoriteSystem?.isInitialized,
        supabase: !!window.supabase,
        currentUser: !!window.currentUser
    });
    
    // Se o sistema está pronto, usar normalmente
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
    } 
    // Se o sistema existe mas não está inicializado
    else if (window.favoriteSystem && !window.favoriteSystem.isInitialized) {
        console.log('🔄 Sistema existe mas não está inicializado, tentando inicializar...');
        showQuickToast('⏳ Inicializando sistema...');
        
        try {
            const success = await window.favoriteSystem.initialize();
            if (success) {
                // Tentar novamente após inicialização
                const cardElement = event ? event.target.closest('.user-card') : null;
                const result = await window.favoriteSystem.toggleFavorite(userId, cardElement);
                return result;
            } else {
                throw new Error('Falha na inicialização');
            }
        } catch (error) {
            console.error('❌ Erro ao inicializar e executar:', error);
            showQuickToast('❌ Sistema indisponível');
            return false;
        }
    }
    // Se o sistema não existe
    else {
        console.error('❌ favoriteSystem não disponível');
        showQuickToast('⚠️ Sistema carregando... tente novamente.');
        
        // Tentar inicializar o sistema
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

// Estratégia 1: Quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - iniciando sistema de favoritos...');
    initializeFavoriteSystem();
});

// Estratégia 2: Quando window estiver carregada
window.addEventListener('load', function() {
    console.log('🔄 Window loaded - verificando sistema...');
    if (!window.favoriteSystem || !window.favoriteSystem.isInitialized) {
        console.log('🔄 Tentando inicializar novamente...');
        setTimeout(initializeFavoriteSystem, 1000);
    }
});

// Estratégia 3: Quando supabase e currentUser ficarem disponíveis
let dependencyCheckInterval = setInterval(() => {
    if (window.supabase && window.currentUser && (!window.favoriteSystem || !window.favoriteSystem.isInitialized)) {
        console.log('🔍 Dependências disponíveis - inicializando sistema...');
        initializeFavoriteSystem();
        clearInterval(dependencyCheckInterval);
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
    console.log('- toggleFavorite:', window.toggleFavorite);
};

// Função global de toast (fallback seguro)
if (typeof showQuickToast === 'undefined') {
    window.showQuickToast = function(message) {
        console.log('🔔 TOAST:', message);
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
    };
}

// Função para integração com outros sistemas
window.getFavoriteSystem = function() {
    if (window.favoriteSystem && window.favoriteSystem.isInitialized) {
        return window.favoriteSystem;
    } else {
        console.warn('⚠️ Sistema de favoritos não disponível');
        return null;
    }
};

console.log('✅ home-favoritos.js CARREGADO - sistema de inicialização ativo!');

// Export para módulos (se necessário)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FavoriteSystem, initializeFavoriteSystem };
}