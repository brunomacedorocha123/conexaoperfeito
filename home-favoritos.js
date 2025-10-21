// home-favoritos.js - SISTEMA DIRETO E FUNCIONAL
console.log('⭐ Sistema de favoritos carregado');

// Aguardar tudo carregar e DEPOIS inicializar
window.addEventListener('load', function() {
    console.log('🔄 Página carregada - verificando se podemos inicializar favoritos...');
    
    setTimeout(() => {
        initializeFavoriteSystem();
    }, 2000); // Esperar 2 segundos para garantir que tudo carregou
});

function initializeFavoriteSystem() {
    console.log('🔧 Inicializando sistema de favoritos...');
    console.log('📊 Estado atual:', {
        supabase: !!window.supabase,
        currentUser: !!window.currentUser,
        currentUserId: window.currentUser?.id
    });

    // Se não temos o necessário, tentar novamente em 1 segundo
    if (!window.supabase || !window.currentUser) {
        console.log('⏳ Aguardando supabase/currentUser...');
        setTimeout(initializeFavoriteSystem, 1000);
        return;
    }

    console.log('✅ Tudo pronto! Sistema de favoritos ativo.');
    
    // Marcar que o sistema está carregado
    window.favoriteSystemLoaded = true;
    
    // Mostrar mensagem de sucesso
    if (window.showQuickToast) {
        window.showQuickToast('✅ Sistema de favoritos carregado!');
    }
}

// FUNÇÃO PRINCIPAL - SIMPLES E DIRETA
window.toggleFavorite = async function(userId, event) {
    console.log('❤️ Clicou no coração! UserID:', userId);
    
    if (event) {
        event.stopPropagation();
        event.preventDefault();
    }

    // Verificar se temos o necessário
    if (!window.supabase) {
        console.error('❌ Supabase não carregado');
        alert('Erro: Supabase não carregado');
        return;
    }
    
    if (!window.currentUser) {
        console.error('❌ Usuário não logado');
        alert('Erro: Faça login primeiro');
        return;
    }

    try {
        // 1. Verificar se já é favorito
        console.log('🔍 Verificando favorito...');
        const { data: existing, error: checkError } = await window.supabase
            .from('user_favorites')
            .select('id')
            .eq('user_id', window.currentUser.id)
            .eq('favorite_user_id', userId)
            .single();

        if (checkError && checkError.code !== 'PGRST116') {
            console.error('❌ Erro ao verificar:', checkError);
            alert('Erro: ' + checkError.message);
            return;
        }

        const isFavorite = !!existing;
        console.log('📊 Status:', isFavorite ? 'JÁ É FAVORITO' : 'NÃO É FAVORITO');

        if (isFavorite) {
            // REMOVER
            console.log('➖ Removendo favorito...');
            const { error: deleteError } = await window.supabase
                .from('user_favorites')
                .delete()
                .eq('user_id', window.currentUser.id)
                .eq('favorite_user_id', userId);

            if (deleteError) {
                console.error('❌ Erro ao remover:', deleteError);
                alert('Erro ao remover: ' + deleteError.message);
                return;
            }

            console.log('✅ Favorito removido!');
            
            // Atualizar botão
            if (event) {
                const btn = event.target.closest('.favorite-btn');
                if (btn) {
                    btn.innerHTML = '🤍';
                    btn.classList.remove('favorited');
                }
            }
            
            if (window.showQuickToast) {
                window.showQuickToast('💔 Curtida removida');
            }

        } else {
            // ADICIONAR
            console.log('➕ Adicionando favorito...');
            
            const favoriteData = {
                user_id: window.currentUser.id,
                favorite_user_id: userId,
                created_at: new Date().toISOString()
            };

            const { data, error: insertError } = await window.supabase
                .from('user_favorites')
                .insert(favoriteData)
                .select()
                .single();

            if (insertError) {
                console.error('❌ Erro ao adicionar:', insertError);
                alert('Erro ao adicionar: ' + insertError.message);
                return;
            }

            console.log('✅ Favorito adicionado!', data);
            
            // Atualizar botão
            if (event) {
                const btn = event.target.closest('.favorite-btn');
                if (btn) {
                    btn.innerHTML = '❤️';
                    btn.classList.add('favorited');
                }
            }
            
            if (window.showQuickToast) {
                window.showQuickToast('❤️ Curtida enviada!');
            }

            // Verificar match
            checkMatch(userId);
        }

    } catch (error) {
        console.error('💥 Erro crítico:', error);
        alert('Erro: ' + error.message);
    }
}

// Verificar match mútuo
async function checkMatch(userId) {
    try {
        const { data: mutualLike } = await window.supabase
            .from('user_favorites')
            .select('id')
            .eq('user_id', userId)
            .eq('favorite_user_id', window.currentUser.id)
            .single();

        if (mutualLike) {
            console.log('💝 MATCH!');
            if (window.showQuickToast) {
                window.showQuickToast('💝 Match! Vocês se curtiram!');
            }
        }
    } catch (error) {
        // Ignorar erro (provavelmente não é match)
    }
}

// Função para ir para lista VIP
window.goToVipList = function() {
    window.location.href = 'lista-vip.html';
}

console.log('✅ Sistema de favoritos configurado - toggleFavorite disponível');