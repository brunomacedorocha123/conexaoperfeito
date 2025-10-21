// home-favoritos.js - SISTEMA COMPLETO DE FAVORITOS
console.log('⭐ Iniciando sistema profissional de favoritos...');

class FavoriteSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.isPremium = false;
        this.isInitialized = false;
        this.retryCount = 0;
        this.maxRetries = 3;
        
        console.log('🎯 Sistema de favoritos instanciado para:', currentUser?.email);
    }

    async initialize() {
        try {
            console.log('🔄 Inicializando sistema de favoritos...');
            
            // Verificar dependências críticas
            if (!this.supabase) {
                throw new Error('Supabase client não disponível');
            }
            
            if (!this.currentUser?.id) {
                throw new Error('Usuário não autenticado');
            }
            
            // Verificar conexão com Supabase
            const { data: testData, error: testError } = await this.supabase
                .from('profiles')
                .select('id')
                .eq('id', this.currentUser.id)
                .limit(1)
                .single();

            if (testError && testError.code !== 'PGRST116') {
                throw new Error(`Erro de conexão: ${testError.message}`);
            }
            
            // Carregar status premium
            await this.loadPremiumStatus();
            
            // Marcar como inicializado
            this.isInitialized = true;
            this.retryCount = 0;
            
            console.log('✅ Sistema de favoritos inicializado com sucesso!');
            console.log('👑 Status Premium:', this.isPremium);
            console.log('👤 Usuário:', this.currentUser.email);
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro na inicialização:', error);
            
            // Tentar novamente se não excedeu o limite
            if (this.retryCount < this.maxRetries) {
                this.retryCount++;
                console.log(`🔄 Tentativa ${this.retryCount}/${this.maxRetries} em 2 segundos...`);
                await new Promise(resolve => setTimeout(resolve, 2000));
                return this.initialize();
            }
            
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
            
        } catch (error) {
            console.error('Erro ao carregar status premium:', error);
            this.isPremium = false;
        }
    }

    // 🎯 FUNÇÃO PRINCIPAL - ADICIONAR/REMOVER FAVORITO
    async toggleFavorite(userId, userCardElement = null) {
        console.log('❤️ Processando ação de favorito para:', userId);
        
        try {
            // Validações de segurança
            if (!this.isInitialized) {
                throw new Error('Sistema não inicializado. Aguarde o carregamento.');
            }

            if (!userId || typeof userId !== 'string') {
                throw new Error('ID de usuário inválido');
            }

            if (userId === this.currentUser.id) {
                throw new Error('Não é possível favoritar a si mesmo');
            }

            console.log('🔍 Verificando status atual do favorito...');
            
            // 1. VERIFICAR SE JÁ É FAVORITO
            const { data: existingFavorite, error: checkError } = await this.supabase
                .from('user_favorites')
                .select('id, created_at')
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                console.error('❌ Erro ao verificar favorito:', checkError);
                throw new Error(`Erro ao verificar: ${checkError.message}`);
            }

            const isCurrentlyFavorite = !!existingFavorite;
            console.log('📊 Status atual:', isCurrentlyFavorite ? 'JÁ É FAVORITO' : 'NÃO É FAVORITO');

            let result;
            
            if (isCurrentlyFavorite) {
                // 2. REMOVER FAVORITO
                result = await this.removeFavorite(userId, userCardElement);
            } else {
                // 3. ADICIONAR FAVORITO
                result = await this.addFavorite(userId, userCardElement);
            }

            return result;

        } catch (error) {
            console.error('💥 ERRO CRÍTICO em toggleFavorite:', error);
            this.showNotification('❌ ' + (error.message || 'Erro ao processar ação'));
            throw error;
        }
    }

    async addFavorite(userId, userCardElement) {
        console.log('➕ ADICIONANDO usuário aos favoritos:', userId);
        
        try {
            const favoriteData = {
                user_id: this.currentUser.id,
                favorite_user_id: userId,
                created_at: new Date().toISOString()
            };

            console.log('📤 Enviando dados para Supabase:', favoriteData);

            // Tentar inserção com retorno de dados
            const { data, error } = await this.supabase
                .from('user_favorites')
                .insert(favoriteData)
                .select()
                .single();

            if (error) {
                console.error('❌ Erro na inserção:', error);
                
                // Tentar inserção simples (sem select) como fallback
                console.log('🔄 Tentando inserção alternativa...');
                const { error: simpleError } = await this.supabase
                    .from('user_favorites')
                    .insert(favoriteData);

                if (simpleError) {
                    // Verificar se é erro de duplicidade (já é favorito)
                    if (simpleError.code === '23505') {
                        console.log('ℹ️ Usuário já está nos favoritos');
                        this.updateCardUI(userCardElement, true);
                        this.showNotification('❤️ Usuário já está nos favoritos!');
                        return true;
                    }
                    throw simpleError;
                }
                
                console.log('✅ Favorito adicionado (inserção simples)');
            } else {
                console.log('✅ Favorito adicionado com sucesso:', data);
            }

            // ATUALIZAR INTERFACE
            this.updateCardUI(userCardElement, true);
            
            // SINCRONIZAR COM OUTROS COMPONENTES
            this.syncWithOtherComponents(userId, true);
            
            // FEEDBACK PARA USUÁRIO
            this.showNotification(
                this.isPremium ? 
                '❤️ Adicionado à Lista VIP!' : 
                '❤️ Curtida enviada!'
            );

            // VERIFICAR MATCH MÚTUO
            await this.checkForMutualLike(userId);

            return true;

        } catch (error) {
            console.error('❌ Erro ao adicionar favorito:', error);
            this.showNotification('❌ Erro ao adicionar favorito');
            throw error;
        }
    }

    async removeFavorite(userId, userCardElement) {
        console.log('➖ REMOVENDO usuário dos favoritos:', userId);
        
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
            
            // ATUALIZAR INTERFACE
            this.updateCardUI(userCardElement, false);
            
            // SINCRONIZAR COM OUTROS COMPONENTES
            this.syncWithOtherComponents(userId, false);
            
            // FEEDBACK PARA USUÁRIO
            this.showNotification('💔 Curtida removida');

            return false;

        } catch (error) {
            console.error('❌ Erro ao remover favorito:', error);
            this.showNotification('❌ Erro ao remover favorito');
            throw error;
        }
    }

    async checkForMutualLike(userId) {
        try {
            console.log('🔍 Verificando match mútuo com:', userId);

            const { data: mutualLike, error } = await this.supabase
                .from('user_favorites')
                .select('id, created_at')
                .eq('user_id', userId)
                .eq('favorite_user_id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            if (mutualLike) {
                console.log('💝 MATCH MÚTUO DETECTADO!');
                this.showNotification('💝 Match! Vocês se curtiram!');
                await this.recordMutualLike();
            }

        } catch (error) {
            console.error('Erro ao verificar match:', error);
        }
    }

    async recordMutualLike() {
        try {
            const { data: existingPulse } = await this.supabase
                .from('user_pulses')
                .select('pulse_count')
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

            console.log('📈 Contador de matches atualizado');

        } catch (error) {
            console.error('Erro ao registrar match:', error);
        }
    }

    updateCardUI(cardElement, isFavorite) {
        if (!cardElement) {
            console.log('ℹ️ Elemento do card não fornecido');
            return;
        }

        const favoriteBtn = cardElement.querySelector('.favorite-btn');
        if (!favoriteBtn) {
            console.warn('❌ Botão de favorito não encontrado no card');
            return;
        }

        if (isFavorite) {
            favoriteBtn.innerHTML = '❤️';
            favoriteBtn.title = 'Remover dos favoritos';
            favoriteBtn.classList.add('favorited');
            favoriteBtn.style.transform = 'scale(1.1)';
            
            // Animação de pulso
            setTimeout(() => {
                favoriteBtn.style.transform = 'scale(1)';
            }, 300);
            
            console.log('🎨 UI atualizada: FAVORITADO');
        } else {
            favoriteBtn.innerHTML = '🤍';
            favoriteBtn.title = 'Adicionar aos favoritos';
            favoriteBtn.classList.remove('favorited');
            console.log('🎨 UI atualizada: NÃO FAVORITADO');
        }
    }

    syncWithOtherComponents(userId, isFavorite) {
        // Sincronizar com sistema de usuários se existir
        if (window.updateFavoriteInCard) {
            window.updateFavoriteInCard(userId, isFavorite);
        }
        
        // Disparar evento global para outros componentes
        window.dispatchEvent(new CustomEvent('favoriteUpdated', {
            detail: { userId, isFavorite }
        }));
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

    async getUserFavorites() {
        try {
            const { data: favorites, error } = await this.supabase
                .from('user_favorites')
                .select(`
                    favorite_user_id,
                    created_at,
                    profiles:favorite_user_id (
                        id,
                        nickname,
                        avatar_url,
                        last_online_at
                    )
                `)
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            return favorites || [];

        } catch (error) {
            console.error('Erro ao carregar favoritos:', error);
            return [];
        }
    }

    showNotification(message, type = 'info') {
        const types = {
            info: '#38a169',
            error: '#e53e3e',
            warning: '#d69e2e'
        };
        
        const color = types[type] || types.info;
        
        if (window.showQuickToast) {
            window.showQuickToast(message);
        } else {
            // Notification fallback
            const notification = document.createElement('div');
            notification.style.cssText = `
                position: fixed;
                bottom: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: ${color};
                color: white;
                padding: 12px 24px;
                border-radius: 25px;
                font-size: 14px;
                font-weight: 600;
                z-index: 10000;
                opacity: 0;
                transition: all 0.3s ease;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                text-align: center;
                min-width: 200px;
                max-width: 90%;
            `;
            notification.textContent = message;
            document.body.appendChild(notification);
            
            // Animação de entrada
            setTimeout(() => {
                notification.style.opacity = '1';
                notification.style.transform = 'translateX(-50%) translateY(-10px)';
            }, 100);
            
            // Remover após 3 segundos
            setTimeout(() => {
                notification.style.opacity = '0';
                notification.style.transform = 'translateX(-50%) translateY(10px)';
                setTimeout(() => notification.remove(), 300);
            }, 3000);
        }
    }

    // Método para verificar saúde do sistema
    async healthCheck() {
        try {
            const { data, error } = await this.supabase
                .from('user_favorites')
                .select('id')
                .limit(1);

            return {
                healthy: !error,
                supabaseConnected: !error,
                userAuthenticated: !!this.currentUser,
                systemInitialized: this.isInitialized,
                error: error?.message
            };
        } catch (error) {
            return {
                healthy: false,
                error: error.message
            };
        }
    }
}

// ==================== SISTEMA DE INICIALIZAÇÃO ROBUSTO ====================

async function initializeFavoriteSystem() {
    console.log('🔧 Iniciando sistema de favoritos...');
    
    let attempts = 0;
    const maxAttempts = 15;
    
    while (attempts < maxAttempts) {
        if (window.supabase && window.currentUser) {
            console.log('🚀 Dependências disponíveis - criando sistema...');
            
            try {
                // Criar instância do sistema
                window.favoriteSystem = new FavoriteSystem(window.supabase, window.currentUser);
                
                // Inicializar
                const success = await window.favoriteSystem.initialize();
                
                if (success) {
                    console.log('✅ Sistema de favoritos inicializado com SUCESSO!');
                    
                    // Disparar evento de inicialização
                    window.dispatchEvent(new CustomEvent('favoriteSystemReady'));
                    
                    // Verificar saúde do sistema
                    const health = await window.favoriteSystem.healthCheck();
                    console.log('🏥 Saúde do sistema:', health);
                    
                    return true;
                }
            } catch (error) {
                console.error('❌ Erro na inicialização:', error);
            }
        }
        
        attempts++;
        console.log(`⏳ Aguardando dependências... ${attempts}/${maxAttempts}`);
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    
    console.error('💥 TIMEOUT: Sistema de favoritos não pôde ser inicializado');
    return false;
}

// ==================== FUNÇÃO GLOBAL PRINCIPAL ====================

window.toggleFavorite = async function(userId, event) {
    console.log('🎯 toggleFavorite chamado para:', userId);
    
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    // Verificar se o sistema está pronto
    if (window.favoriteSystem && window.favoriteSystem.isInitialized) {
        try {
            const cardElement = event ? event.target.closest('.user-card') : null;
            const result = await window.favoriteSystem.toggleFavorite(userId, cardElement);
            return result;
        } catch (error) {
            console.error('❌ Erro na execução:', error);
            return false;
        }
    } else {
        console.error('❌ Sistema de favoritos não disponível');
        
        // Tentar inicializar
        const success = await initializeFavoriteSystem();
        if (success) {
            // Retry após inicialização
            const cardElement = event ? event.target.closest('.user-card') : null;
            return window.favoriteSystem.toggleFavorite(userId, cardElement);
        }
        
        return false;
    }
};

// ==================== FUNÇÕES AUXILIARES GLOBAIS ====================

window.goToVipList = function() {
    if (window.favoriteSystem && window.favoriteSystem.isPremium) {
        window.location.href = 'lista-vip.html';
    } else {
        if (window.showQuickToast) {
            window.showQuickToast('⭐ Torne-se Premium para acessar a Lista VIP!');
        }
        window.location.href = 'princing.html';
    }
};

window.getFavoriteSystem = function() {
    return window.favoriteSystem;
};

window.debugFavoriteSystem = function() {
    console.log('🔍 DEBUG - Sistema de Favoritos:');
    console.log('- Sistema:', window.favoriteSystem);
    console.log('- Inicializado:', window.favoriteSystem?.isInitialized);
    console.log('- Premium:', window.favoriteSystem?.isPremium);
    console.log('- Supabase:', window.supabase ? '✅ Disponível' : '❌ Indisponível');
    console.log('- CurrentUser:', window.currentUser ? `✅ ${window.currentUser.email}` : '❌ Indisponível');
    
    if (window.favoriteSystem) {
        window.favoriteSystem.healthCheck().then(health => {
            console.log('- Saúde do sistema:', health);
        });
    }
};

// ==================== INICIALIZAÇÃO AUTOMÁTICA ====================

document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - iniciando sistema de favoritos...');
    initializeFavoriteSystem();
});

window.addEventListener('load', function() {
    console.log('🔄 Página totalmente carregada - verificando sistema...');
    if (!window.favoriteSystem || !window.favoriteSystem.isInitialized) {
        setTimeout(initializeFavoriteSystem, 1000);
    }
});

// Fallback para toast global
if (typeof showQuickToast === 'undefined') {
    window.showQuickToast = function(message) {
        console.log('🔔 TOAST:', message);
        // Usar o sistema de notificação do FavoriteSystem se disponível
        if (window.favoriteSystem) {
            window.favoriteSystem.showNotification(message);
        }
    };
}

console.log('✅ home-favoritos.js CARREGADO - Sistema profissional pronto!');

// Export para uso em outros módulos
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { FavoriteSystem, initializeFavoriteSystem };
}