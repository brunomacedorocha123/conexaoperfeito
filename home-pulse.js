// ==================== SISTEMA PULSE ====================
// ✅ CORREÇÃO CRÍTICA: Inicialização garantida do Pulse System
async function initializePulseSystemWithRetry() {
    console.log('🎯 Inicializando Pulse System com retry...');
    
    let attempts = 0;
    const maxAttempts = 15; // Aumentado para 15 tentativas
    
    while (attempts < maxAttempts) {
        if (window.initializePulseSystem && window.PulseSystem) {
            try {
                console.log('✅ Pulse System encontrado, inicializando...');
                window.pulseSystem = await window.initializePulseSystem(supabase, currentUser);
                console.log('✅ Pulse System inicializado com sucesso!');
                
                // Adicionar cards VIP se for premium
                if (userProfile?.is_premium && window.pulseSystem.addVipCardsToHome) {
                    setTimeout(() => {
                        window.pulseSystem.addVipCardsToHome().catch(console.error);
                    }, 2000);
                }
                return true;
            } catch (error) {
                console.error('❌ Erro na inicialização do Pulse:', error);
            }
        }
        
        console.log(`⏳ Aguardando Pulse System... (${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 500));
        attempts++;
    }
    
    console.error('❌ Pulse System não carregou após todas as tentativas');
    return false;
}

// ✅ GARANTIR CARREGAMENTO TARDIO DO PULSE SYSTEM
function initializePulseSystemLate() {
    setTimeout(() => {
        if (currentUser && window.initializePulseSystem && !window.pulseSystem) {
            console.log('🔄 Inicialização tardia do Pulse System...');
            window.initializePulseSystem(supabase, currentUser).then(system => {
                window.pulseSystem = system;
                console.log('✅ Pulse System carregado via inicialização tardia');
                
                // Tentar adicionar cards VIP se for premium
                if (userProfile?.is_premium) {
                    setTimeout(() => {
                        if (window.pulseSystem.addVipCardsToHome) {
                            window.pulseSystem.addVipCardsToHome().catch(console.error);
                        }
                    }, 1000);
                }
            }).catch(console.error);
        }
    }, 5000);
}

// ✅ FUNÇÃO PARA CLIQUE NO BOTÃO PULSE
async function handlePulseClick(userId, button) {
    try {
        console.log('💗 Clique no pulse para:', userId);
        
        if (!window.pulseSystem) {
            showQuickToast('Sistema de curtidas não disponível.');
            return;
        }

        const isCurrentlyLiked = window.pulseSystem.isUserLiked(userId);
        
        if (isCurrentlyLiked) {
            // Remover curtida
            await window.pulseSystem.revokePulse(userId);
            button.innerHTML = '💗 Pulse';
            button.classList.remove('pulse-active', 'pulse-match');
            showQuickToast('Curtida removida');
        } else {
            // Adicionar curtida
            await window.pulseSystem.createPulse(userId);
            button.innerHTML = '💗 Curtido';
            button.classList.add('pulse-active');
            
            // Verificar match
            if (window.pulseSystem.isMatch(userId)) {
                button.innerHTML = '💝 Match!';
                button.classList.add('pulse-match');
                showQuickToast('💝 Novo match!');
                
                // Atualizar lista VIP se for match
                setTimeout(() => {
                    if (window.atualizarListaVIP) {
                        window.atualizarListaVIP();
                    }
                }, 500);
            } else {
                showQuickToast('Curtida enviada!');
            }
        }

        // Atualizar contadores
        if (window.pulseSystem.updatePulseCounters) {
            window.pulseSystem.updatePulseCounters();
        }

        // Atualizar estatísticas
        setTimeout(() => {
            if (window.updateStats) {
                window.updateStats().catch(console.error);
            }
        }, 300);

    } catch (error) {
        console.error('❌ Erro ao curtir:', error);
        showQuickToast('Erro ao curtir');
    }
}

// ✅ FUNÇÃO PARA ATUALIZAR LISTA VIP APÓS CURTIDA
async function atualizarListaVIP() {
    try {
        console.log('🔄 Atualizando lista VIP...');
        
        // Se estiver na página lista-vip.html, recarregar a lista
        if (window.location.pathname.includes('lista-vip.html')) {
            if (window.loadVipList) {
                await window.loadVipList();
            }
        }
        
        // Se estiver na home e for premium, atualizar cards VIP
        if (window.location.pathname.includes('home.html') && userProfile?.is_premium) {
            if (window.pulseSystem && window.pulseSystem.addVipCardsToHome) {
                setTimeout(() => {
                    window.pulseSystem.addVipCardsToHome().catch(console.error);
                }, 500);
            }
        }
        
        // ✅ ATUALIZAR ESTATÍSTICAS NA HOME
        if (window.updateStats) {
            setTimeout(() => {
                window.updateStats().catch(console.error);
            }, 300);
        }
        
        console.log('✅ Lista VIP atualizada');
    } catch (error) {
        console.error('❌ Erro ao atualizar lista VIP:', error);
    }
}

// ✅ FUNÇÃO PARA DEBUG DO PULSE SYSTEM
function debugPulseSystem() {
    console.log('🔍 DEBUG PULSE SYSTEM:');
    console.log('- window.initializePulseSystem:', !!window.initializePulseSystem);
    console.log('- window.PulseSystem:', !!window.PulseSystem);
    console.log('- window.pulseSystem:', window.pulseSystem);
    console.log('- currentUser:', !!currentUser);
    
    if (window.pulseSystem) {
        console.log('- pulsesData:', {
            dados: window.pulseSystem.pulsesData?.given?.size || 0,
            recebidos: window.pulseSystem.pulsesData?.received?.size || 0,
            matches: window.pulseSystem.pulsesData?.matches?.size || 0
        });
    }
    
    // Verificar botões pulse nos cards
    const pulseButtons = document.querySelectorAll('.pulse-btn');
    console.log('- Botões Pulse encontrados:', pulseButtons.length);
    
    return {
        pulseSystemLoaded: !!window.pulseSystem,
        pulseButtons: pulseButtons.length,
        currentUser: !!currentUser
    };
}

// ✅ EXPORTAR FUNÇÕES PULSE PARA ACESSO GLOBAL
window.initializePulseSystemWithRetry = initializePulseSystemWithRetry;
window.initializePulseSystemLate = initializePulseSystemLate;
window.handlePulseClick = handlePulseClick;
window.atualizarListaVIP = atualizarListaVIP;
window.debugPulseSystem = debugPulseSystem;

console.log('✅ home-pulse.js carregado!');