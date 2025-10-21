// home-favoritos.js - SISTEMA COMPLETO DE FAVORITOS
console.log('🚀 Sistema de favoritos carregando...');

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
            
            if (!this.supabase) {
                throw new Error('Supabase não disponível');
            }
            
            if (!this.currentUser?.id) {
                throw new Error('Usuário não autenticado');
            }

            console.log('✅ Dependências verificadas');
            
            // Testar conexão
            const { error: testError } = await this.supabase
                .from('profiles')
                .select('id')
                .eq('id', this.currentUser.id)
                .limit(1);

            if (testError) {
                throw new Error(`Erro de conexão: ${testError.message}`);
            }

            // Carregar status premium
            await this.loadPremiumStatus();
            
            this.isInitialized = true;
            console.log('✅ Sistema de favoritos inicializado!');
            console.log('👑 Premium:', this.isPremium);
            
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
                console.warn('⚠️ Erro ao verificar premium:', error);
                this.isPremium = false;
                return;
            }

            this.isPremium = profile?.is_premium || false;
            
        } catch (error) {
            console.error('Erro ao carregar premium:', error);
            this.isPremium = false;
        }
    }

    async toggleFavorite(userId, userCardElement = null) {
        console.log('❤️ toggleFavorite chamado para:', userId);
        
        try {
            if (!this.isInitialized) {
                throw new Error('Sistema não inicializado');
            }

            if (!userId) {
                throw new Error('ID do usuário não fornecido');
            }

            console.log('🔍 Verificando favorito...');
            
            const { data: existingFavorite, error: checkError } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('❌ Erro ao verificar:', checkError);
                throw checkError;
            }

            const isCurrentlyFavorite = !!existingFavorite;
            console.log('📊 Status:', isCurrentlyFavorite ? 'FAVORITO' : 'NÃO FAVORITO');

            if (isCurrentlyFavorite) {
                await this.removeFavorite(userId, userCardElement);
            } else {
                await this.addFavorite(userId, userCardElement);
            }

            return !isCurrentlyFavorite;

        } catch (error) {
            console.error('💥 ERRO em toggleFavorite:', error);
            this.showNotification('❌ Erro ao processar curtida');
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

            console.log('📤 Enviando dados:', favoriteData);

            const { data, error } = await this.supabase
                .from('user_favorites')
                .insert(favoriteData)
                .select()
                .single();

            if (error) {
                console.error('❌ Erro ao adicionar:', error);
                throw error;
            }

            console.log('✅ Favorito adicionado:', data);

            this.updateCardUI(userCardElement, true);
            
            if (window.updateFavoriteInCard) {
                window.updateFavoriteInCard(userId, true);
            }
            
            if (this.isPremium) {
                this.showNotification('❤️ Adicionado à Lista VIP!');
            } else {
                this.showNotification('❤️ Curtida enviada!');
            }

            await this.checkMutualLike(userId);

        } catch (error) {
            console.error('❌ Erro ao adicionar favorito:', error);
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
                console.error('❌ Erro ao remover:', error);
                throw error;
            }

            console.log('✅ Favorito removido');
            
            this.updateCardUI(userCardElement, false);
            
            if (window.updateFavoriteInCard) {
                window.updateFavoriteInCard(userId, false);
            }
            
            this.showNotification('💔 Curtida removida');

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
            console.log('ℹ️ Nenhum card element fornecido');
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
            console.log('🔔 TOAST:', message);
        }
    }
}

// ==================== INICIALIZAÇÃO ====================

async function initializeFavoriteSystem() {
    console.log('🔧 Inicializando sistema de favoritos...');
    
    let tentativas = 0;
    const maxTentativas = 20;
    
    while (tentativas < maxTentativas) {
        if (window.supabase && window.currentUser) {
            console.log('🚀 Dependências encontradas - criando sistema...');
            
            try {
                window.favoriteSystem = new FavoriteSystem(window.supabase, window.currentUser);
                const success = await window.favoriteSystem.initialize();
                
                if (success) {
                    console.log('✅ Sistema de favoritos inicializado com SUCESSO!');
                    return true;
                }
            } catch (error) {
                console.error('❌ Erro na inicialização:', error);
            }
        }
        
        console.log('⏳ Aguardando dependências...', tentativas + 1);
        await new Promise(resolve => setTimeout(resolve, 500));
        tentativas++;
    }
    
    console.error('💥 TIMEOUT: Sistema não inicializado');
    return false;
}

// ==================== FUNÇÃO GLOBAL ====================

window.toggleFavorite = async function(userId, event) {
    console.log('🎯 toggleFavorite GLOBAL chamado para:', userId);
    
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('📊 Estado:', {
        favoriteSystem: !!window.favoriteSystem,
        isInitialized: window.favoriteSystem?.isInitialized
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
        console.error('❌ Sistema não disponível');
        showQuickToast('⚠️ Sistema carregando...');
        
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

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - iniciando sistema...');
    initializeFavoriteSystem();
});

window.addEventListener('load', function() {
    console.log('🔄 Window loaded - verificando sistema...');
    if (!window.favoriteSystem || !window.favoriteSystem.isInitialized) {
        setTimeout(initializeFavoriteSystem, 2000);
    }
});

// Debug helper
window.debugFavoriteSystem = function() {
    console.log('🔍 DEBUG - Sistema de Favoritos:');
    console.log('- favoriteSystem:', window.favoriteSystem);
    console.log('- isInitialized:', window.favoriteSystem?.isInitialized);
    console.log('- isPremium:', window.favoriteSystem?.isPremium);
    console.log('- supabase:', window.supabase);
    console.log('- currentUser:', window.currentUser);
};

// Fallback para toast
if (typeof showQuickToast === 'undefined') {
    window.showQuickToast = function(message) {
        console.log('🔔 TOAST:', message);
    };
}

console.log('✅ home-favoritos.js CARREGADO!');