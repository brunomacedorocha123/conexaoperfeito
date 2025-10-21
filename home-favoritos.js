// home-favoritos.js - SISTEMA COMPLETO E FUNCIONAL
console.log('🚀 Iniciando sistema de favoritos...');

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
            
            if (!this.supabase) {
                throw new Error('Supabase não disponível');
            }
            
            if (!this.currentUser) {
                throw new Error('Usuário não autenticado');
            }
            
            await this.checkPremiumStatus();
            this.isInitialized = true;
            console.log('✅ Sistema de favoritos inicializado com sucesso!');
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

            if (error) {
                console.warn('⚠️ Erro ao verificar premium:', error);
                this.isPremium = false;
                return;
            }

            this.isPremium = profile?.is_premium || false;
            console.log('👑 Status Premium:', this.isPremium);
            
        } catch (error) {
            console.error('Erro ao verificar premium:', error);
            this.isPremium = false;
        }
    }

    // ❤️ FUNÇÃO PRINCIPAL - CORAÇÃO DOS FAVORITOS
    async toggleFavorite(userId, userCardElement = null) {
        console.log('❤️ toggleFavorite chamado para:', userId);
        
        try {
            // Verificações de segurança
            if (!this.isInitialized) {
                throw new Error('Sistema de favoritos não inicializado');
            }

            if (!userId) {
                throw new Error('ID do usuário não fornecido');
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
            console.log('📊 Status atual:', isCurrentlyFavorite ? 'FAVORITO' : 'NÃO FAVORITO');

            if (isCurrentlyFavorite) {
                await this.removeFavorite(userId, userCardElement);
            } else {
                await this.addFavorite(userId, userCardElement);
            }

            return !isCurrentlyFavorite;

        } catch (error) {
            console.error('💥 ERRO em toggleFavorite:', error);
            this.showToast('❌ Erro ao processar curtida: ' + (error.message || 'Erro desconhecido'));
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

            console.log('📤 Enviando para Supabase:', favoriteData);

            const { data, error } = await this.supabase
                .from('user_favorites')
                .insert(favoriteData)
                .select()
                .single();

            if (error) {
                console.error('❌ Erro do Supabase ao adicionar:', error);
                
                // Tentar inserção simples sem select
                console.log('🔄 Tentando inserção alternativa...');
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
            
            // Atualizar outros cards se existirem
            if (window.updateFavoriteInCard) {
                window.updateFavoriteInCard(userId, true);
            }
            
            // Feedback para usuário
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
            console.warn('❌ Botão de favorito não encontrado no card');
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

// ==================== INICIALIZAÇÃO AUTOMÁTICA ====================

async function initializeFavoriteSystem() {
    console.log('🔧 Inicializando sistema de favoritos...');
    
    let tentativas = 0;
    const maxTentativas = 20;
    
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
        showQuickToast('⚠️ Sistema carregando... tente novamente em alguns segundos.');
        
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

// ==================== INICIALIZAÇÃO ====================

// Inicializar quando DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - iniciando sistema de favoritos...');
    initializeFavoriteSystem();
});

// Fallback adicional
window.addEventListener('load', function() {
    console.log('🔄 Window loaded - verificando sistema...');
    if (!window.favoriteSystem || !window.favoriteSystem.isInitialized) {
        console.log('🔄 Tentando inicializar novamente...');
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

console.log('✅ home-favoritos.js CARREGADO - pronto para inicializar!');

// Teste automático após 3 segundos
setTimeout(() => {
    if (window.favoriteSystem && window.favoriteSystem.isInitialized) {
        console.log('🎉 Sistema de favoritos funcionando perfeitamente!');
    } else {
        console.warn('⚠️ Sistema de favoritos ainda não inicializado');
    }
}, 3000);