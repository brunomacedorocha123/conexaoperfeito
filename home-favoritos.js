// home-favoritos.js - Sistema de Favoritos e Lista VIP - CORRIGIDO
class FavoriteSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.isPremium = false;
        console.log('🎯 FavoriteSystem construído:', { 
            user: currentUser?.id,
            supabase: !!supabase 
        });
    }

    async initialize() {
        try {
            console.log('🎯 Inicializando sistema de favoritos...');
            
            // Verificar se usuário é premium
            await this.checkPremiumStatus();
            
            // Carregar contador de pulses
            await this.loadPulseCount();
            
            console.log('✅ Sistema de favoritos inicializado!');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar sistema de favoritos:', error);
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
                console.log(`👑 Status Premium: ${this.isPremium}`);
            }
        } catch (error) {
            console.error('Erro ao verificar status premium:', error);
        }
    }

    // ❤️ Curtir/Descurtir usuário
    async toggleFavorite(userId, userCardElement = null) {
        try {
            console.log(`❤️ TENTANDO curtir usuário: ${userId}`, {
                currentUser: this.currentUser.id,
                cardElement: !!userCardElement
            });

            // Verificar se usuário está bloqueado
            if (window.blockSystem && window.blockSystem.isUserBlocked(userId)) {
                showQuickToast('🚫 Você bloqueou este usuário.');
                return;
            }

            // Verificar se está bloqueado pelo usuário
            const isBlockedByUser = await this.checkIfBlockedByUser(userId);
            if (isBlockedByUser) {
                showQuickToast('🚫 Este usuário te bloqueou.');
                if (window.blockSystem) {
                    window.blockSystem.removeUserCardImmediately(userId);
                }
                return;
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

            console.log(`📊 Favorito existente: ${!!existingFavorite}`);

            if (existingFavorite) {
                // ❌ Remover dos favoritos
                await this.removeFavorite(userId, userCardElement);
            } else {
                // ✅ Adicionar aos favoritos
                await this.addFavorite(userId, userCardElement);
            }

        } catch (error) {
            console.error('❌ Erro ao alternar favorito:', error);
            showQuickToast('⚠️ Erro ao processar curtida. Tente novamente.');
        }
    }

    async addFavorite(userId, userCardElement) {
        try {
            console.log(`➕ ADICIONANDO favorito: ${userId}`);

            const { data, error } = await this.supabase
                .from('user_favorites')
                .insert({
                    user_id: this.currentUser.id,
                    favorite_user_id: userId,
                    created_at: new Date().toISOString()
                })
                .select()
                .single();

            if (error) {
                console.error('❌ Erro Supabase ao adicionar:', error);
                throw error;
            }

            console.log('✅ Usuário adicionado aos favoritos:', data);

            // Atualizar UI do card
            if (userCardElement) {
                this.updateCardUI(userCardElement, true);
            } else {
                // Fallback: atualizar via função global
                if (window.updateFavoriteInCard) {
                    window.updateFavoriteInCard(userId, true);
                }
            }

            // Verificar se é match mútuo
            await this.checkMutualLike(userId);

            // Mostrar feedback
            if (this.isPremium) {
                showQuickToast('❤️ Adicionado à sua Lista VIP!');
            } else {
                showQuickToast('❤️ Curtida enviada! Torne-se Premium para salvar na Lista VIP.');
            }

        } catch (error) {
            console.error('❌ Erro ao adicionar favorito:', error);
            showQuickToast('❌ Erro ao curtir. Tente novamente.');
            throw error;
        }
    }

    async removeFavorite(userId, userCardElement) {
        try {
            console.log(`➖ REMOVENDO favorito: ${userId}`);

            const { error } = await this.supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId);

            if (error) {
                console.error('❌ Erro Supabase ao remover:', error);
                throw error;
            }

            console.log('❌ Usuário removido dos favoritos:', userId);

            // Atualizar UI do card
            if (userCardElement) {
                this.updateCardUI(userCardElement, false);
            } else {
                // Fallback: atualizar via função global
                if (window.updateFavoriteInCard) {
                    window.updateFavoriteInCard(userId, false);
                }
            }

            showQuickToast('💔 Curtida removida');

        } catch (error) {
            console.error('❌ Erro ao remover favorito:', error);
            showQuickToast('❌ Erro ao remover curtida. Tente novamente.');
            throw error;
        }
    }

    // 🔄 Verificar match mútuo
    async checkMutualLike(userId) {
        try {
            console.log(`🔍 Verificando match mútuo com: ${userId}`);

            // Verificar se o outro usuário também curtiu
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
                console.log('🔄 MATCH MÚTUO detectado!');
                await this.incrementPulseCount();
                showQuickToast('💝 Match! Vocês curtiram um ao outro!');
                
                // Notificar o outro usuário (opcional)
                await this.createMutualLikeNotification(userId);
            } else {
                console.log('📊 Ainda não é match mútuo');
            }

        } catch (error) {
            console.error('❌ Erro ao verificar match mútuo:', error);
        }
    }

    // 📈 Incrementar contador de pulses
    async incrementPulseCount() {
        try {
            // Verificar se já existe registro
            const { data: existingPulse, error: checkError } = await this.supabase
                .from('user_pulses')
                .select('id, pulse_count')
                .eq('user_id', this.currentUser.id)
                .single();

            if (checkError && checkError.code !== 'PGRST116') {
                throw checkError;
            }

            if (existingPulse) {
                // Atualizar contador existente
                const { error } = await this.supabase
                    .from('user_pulses')
                    .update({
                        pulse_count: existingPulse.pulse_count + 1,
                        last_updated: new Date().toISOString()
                    })
                    .eq('user_id', this.currentUser.id);

                if (error) throw error;
            } else {
                // Criar novo registro
                const { error } = await this.supabase
                    .from('user_pulses')
                    .insert({
                        user_id: this.currentUser.id,
                        pulse_count: 1,
                        last_updated: new Date().toISOString()
                    });

                if (error) throw error;
            }

            console.log('📈 Pulse count incrementado');

            // Atualizar badge
            await this.loadPulseCount();

        } catch (error) {
            console.error('❌ Erro ao incrementar pulse count:', error);
        }
    }

    // 📊 Carregar contador de pulses
    async loadPulseCount() {
        try {
            const { data: pulseData, error } = await this.supabase
                .from('user_pulses')
                .select('pulse_count')
                .eq('user_id', this.currentUser.id)
                .single();

            if (error && error.code !== 'PGRST116') {
                throw error;
            }

            const pulseCount = pulseData?.pulse_count || 0;
            this.updatePulseBadge(pulseCount);
            
            console.log(`📊 Pulse count carregado: ${pulseCount}`);
            return pulseCount;

        } catch (error) {
            console.error('❌ Erro ao carregar pulse count:', error);
            return 0;
        }
    }

    // 🎯 Atualizar badge de pulses na UI
    updatePulseBadge(count) {
        // Remover badges existentes
        document.querySelectorAll('.pulse-badge').forEach(badge => badge.remove());
        
        if (count > 0) {
            // Adicionar badge no header (próximo ao sino de notificações)
            const notificationBell = document.getElementById('notificationBell');
            if (notificationBell) {
                const pulseBadge = document.createElement('span');
                pulseBadge.className = 'pulse-badge';
                pulseBadge.textContent = count;
                pulseBadge.style.cssText = `
                    position: absolute;
                    top: -8px;
                    right: -8px;
                    background: linear-gradient(135deg, #ff6b6b, #ee5a52);
                    color: white;
                    border-radius: 50%;
                    width: 20px;
                    height: 20px;
                    font-size: 12px;
                    font-weight: bold;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 2px solid white;
                    z-index: 10;
                `;
                notificationBell.style.position = 'relative';
                notificationBell.appendChild(pulseBadge);
                
                console.log(`🎯 Pulse badge adicionado: ${count}`);
            }
        }
    }

    // 🎨 Atualizar UI do card
    updateCardUI(cardElement, isFavorite) {
        const favoriteBtn = cardElement.querySelector('.favorite-btn');
        if (favoriteBtn) {
            if (isFavorite) {
                favoriteBtn.innerHTML = '❤️';
                favoriteBtn.title = 'Remover dos favoritos';
                favoriteBtn.classList.add('favorited');
                console.log('🎨 Card atualizado: Favoritado');
            } else {
                favoriteBtn.innerHTML = '🤍';
                favoriteBtn.title = 'Adicionar aos favoritos';
                favoriteBtn.classList.remove('favorited');
                console.log('🎨 Card atualizado: Não favoritado');
            }
        } else {
            console.warn('❌ Botão de favorito não encontrado no card');
        }
    }

    // 🔍 Verificar se usuário está bloqueado
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
            console.error('Erro ao verificar bloqueio:', error);
            return false;
        }
    }

    // 🔔 Criar notificação de match mútuo
    async createMutualLikeNotification(targetUserId) {
        try {
            const { error } = await this.supabase
                .from('notifications')
                .insert({
                    user_id: targetUserId,
                    type: 'mutual_like',
                    title: '💝 Novo Match!',
                    message: `Você e ${this.currentUser.user_metadata?.nickname || 'alguém'} curtiram um ao outro!`,
                    created_at: new Date().toISOString()
                });

            if (error) throw error;
            
            console.log('🔔 Notificação de match criada');
            
        } catch (error) {
            console.error('❌ Erro ao criar notificação:', error);
        }
    }

    // 📋 Buscar lista de favoritos do usuário
    async getUserFavorites() {
        try {
            const { data: favorites, error } = await this.supabase
                .from('user_favorites')
                .select(`
                    favorite_user_id,
                    created_at,
                    profiles:user_favorites_favorite_user_id_fkey (
                        id, nickname, avatar_url, age, city, bio, is_premium
                    )
                `)
                .eq('user_id', this.currentUser.id)
                .order('created_at', { ascending: false });

            if (error) throw error;

            console.log(`📋 ${favorites?.length || 0} favoritos encontrados`);
            return favorites || [];

        } catch (error) {
            console.error('❌ Erro ao buscar favoritos:', error);
            return [];
        }
    }

    // 🔄 Verificar se usuário é favorito
    async isUserFavorite(userId) {
        try {
            const { data: favorite, error } = await this.supabase
                .from('user_favorites')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('favorite_user_id', userId)
                .single();

            if (error) {
                if (error.code === 'PGRST116') return false;
                throw error;
            }

            console.log(`🔍 Usuário ${userId} é favorito: ${!!favorite}`);
            return !!favorite;

        } catch (error) {
            console.error('❌ Erro ao verificar favorito:', error);
            return false;
        }
    }
}

// ==================== INICIALIZAÇÃO AUTOMÁTICA ====================

// 🔥 CORREÇÃO CRÍTICA: Sistema de inicialização automática
async function initializeFavoriteSystem() {
    try {
        console.log('🔧 Inicializando sistema de favoritos...');
        
        // Aguardar variáveis globais estarem disponíveis
        let tentativas = 0;
        while (tentativas < 10) {
            if (window.supabase && window.currentUser) {
                console.log('🚀 Inicializando FavoriteSystem...');
                window.favoriteSystem = new FavoriteSystem(window.supabase, window.currentUser);
                await window.favoriteSystem.initialize();
                console.log('✅ Sistema de favoritos inicializado com sucesso!');
                return;
            }
            console.log('⏳ Aguardando supabase e currentUser...', tentativas + 1);
            await new Promise(resolve => setTimeout(resolve, 500));
            tentativas++;
        }
        
        console.error('❌ Não foi possível inicializar sistema de favoritos: supabase ou currentUser não encontrados');
    } catch (error) {
        console.error('❌ Erro crítico na inicialização do sistema de favoritos:', error);
    }
}

// ==================== FUNÇÕES GLOBAIS ====================

window.toggleFavorite = function(userId, event) {
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }
    
    console.log(`❤️ toggleFavorite chamado para: ${userId}`);
    
    if (window.favoriteSystem) {
        const cardElement = event ? event.target.closest('.user-card') : null;
        window.favoriteSystem.toggleFavorite(userId, cardElement);
    } else {
        console.error('❌ favoriteSystem não disponível');
        showQuickToast('⚠️ Sistema de favoritos não carregado. Recarregue a página.');
    }
};

// Função para ir para a Lista VIP
window.goToVipList = function() {
    if (window.favoriteSystem && window.favoriteSystem.isPremium) {
        window.location.href = 'lista-vip.html';
    } else {
        showQuickToast('⭐ Torne-se Premium para acessar a Lista VIP!');
        window.location.href = 'princing.html';
    }
};

// ==================== INICIALIZAÇÃO ====================

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', function() {
    console.log('📄 DOM carregado - iniciando sistema de favoritos...');
    initializeFavoriteSystem();
});

// Fallback: também tentar inicializar quando a janela carregar
window.addEventListener('load', function() {
    console.log('🔄 Window loaded - verificando sistema de favoritos...');
    if (!window.favoriteSystem) {
        console.log('🔄 Tentando inicializar sistema de favoritos novamente...');
        initializeFavoriteSystem();
    }
});

console.log('✅ home-favoritos.js carregado!');