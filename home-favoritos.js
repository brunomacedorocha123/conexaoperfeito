// home-favoritos.js - SISTEMA COMPLETO E FUNCIONAL
console.log('🚀 Iniciando sistema de favoritos...');

class FavoriteSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.isPremium = false;
        console.log('🎯 FavoriteSystem criado para usuário:', currentUser?.id);
    }

    async initialize() {
        try {
            console.log('🔄 Inicializando sistema de favoritos...');
            await this.checkPremiumStatus();
            console.log('✅ Sistema de favoritos pronto!');
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
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
        }
    }

    // ❤️ FUNÇÃO PRINCIPAL DE CURTIR - CORRIGIDA
    async toggleFavorite(userId, userCardElement = null) {
        try {
            console.log('❤️ Processando curtida para:', userId);
            
            // Verificação básica
            if (!this.supabase || !this.currentUser) {
                throw new Error('Sistema não inicializado');
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

        } catch (error) {
            console.error('💥 ERRO CRÍTICO em toggleFavorite:', error);
            showQuickToast('❌ Erro ao processar curtida');
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
                
                // Tentar inserção alternativa sem .select()
                const { error: simpleError } = await this.supabase
                    .from('user_favorites')
                    .insert(favoriteData);

                if (simpleError) {
                    throw simpleError;
                }
                
                console.log('✅ Favorito adicionado (inserção simples)');
            } else {
                console.log('✅ Favorito adicionado com sucesso:', data);
            }

            // Atualizar UI
            this.updateCardUI(userCardElement, true);
            
            // Feedback para usuário
            if (this.isPremium) {
                showQuickToast('❤️ Adicionado à Lista VIP!');
            } else {
                showQuickToast('❤️ Curtida enviada!');
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
            showQuickToast('💔 Curtida removida');

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
                showQuickToast('💝 Match! Vocês se curtiram!');
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
}

// ==================== INICIALIZAÇÃO AUTOMÁTICA ====================

async function initializeFavoriteSystem() {
    console.log('🔧 Iniciando sistema de favoritos...');
    
    let tentativas = 0;
    const maxTentativas = 15; // Aumentei para 15 tentativas
    
    while (tentativas < maxTentativas) {
        if (window.supabase && window.currentUser) {
            console.log('🚀 Inicializando FavoriteSystem...');
            
            try {
                window.favoriteSystem = new FavoriteSystem(window.supabase, window.currentUser);
                await window.favoriteSystem.initialize();
                console.log('✅ Sistema de favoritos inicializado com SUCESSO!');
                return true;
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

window.toggleFavorite = function(userId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log('🎯 toggleFavorite CHAMADO para:', userId);
    console.log('📊 Estado do sistema:', {
        favoriteSystem: !!window.favoriteSystem,
        supabase: !!window.supabase,
        currentUser: !!window.currentUser
    });
    
    if (window.favoriteSystem) {
        const cardElement = event ? event.target.closest('.user-card') : null;
        window.favoriteSystem.toggleFavorite(userId, cardElement);
    } else {
        console.error('❌ favoriteSystem não disponível');
        showQuickToast('⚠️ Sistema carregando... tente novamente em alguns segundos.');
        
        // Tentar inicializar novamente
        setTimeout(() => {
            initializeFavoriteSystem();
        }, 1000);
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

// ==================== INICIALIZAÇÃO ====================

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - iniciando sistema de favoritos...');
    initializeFavoriteSystem();
});

// Fallback adicional
window.addEventListener('load', function() {
    console.log('🔄 Window loaded - verificando sistema...');
    if (!window.favoriteSystem) {
        console.log('🔄 Tentando inicializar novamente...');
        setTimeout(initializeFavoriteSystem, 2000);
    }
});

// Debug helper
window.debugFavoriteSystem = function() {
    console.log('🔍 DEBUG - Sistema de Favoritos:');
    console.log('- favoriteSystem:', window.favoriteSystem);
    console.log('- supabase:', window.supabase);
    console.log('- currentUser:', window.currentUser);
    console.log('- toggleFavorite:', window.toggleFavorite);
};

console.log('✅ home-favoritos.js CARREGADO - pronto para inicializar!');