// home-visitante.js - SISTEMA COMPLETO DE VISITANTES CORRIGIDO
console.log('🚀 home-visitante.js carregando...');

class HomeVisitanteSystem {
    constructor(supabase, currentUser) {
        console.log('🔧 Construtor do VisitanteSystem');
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.visitantes = [];
        this.visitCount = 0;
        this.isPremium = false;
        this.initialized = false;
    }

    async initialize() {
        try {
            console.log('🎯 Inicializando sistema de visitantes...');
            
            // 1. Verificar status premium
            await this.verificarStatusPremium();
            
            // 2. Carregar dados baseados no status
            await this.carregarSistemaVisitantes();
            
            // 3. Atualizar UI IMEDIATAMENTE
            this.atualizarUI();
            
            this.initialized = true;
            console.log('✅ Sistema de visitantes inicializado com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar:', error);
            this.visitCount = 0;
            this.visitantes = [];
            this.atualizarUI(); // Atualizar mesmo com erro
        }
    }

    async verificarStatusPremium() {
        try {
            console.log('⭐ Verificando status premium...');
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', this.currentUser.id)
                .single();

            if (error) {
                console.error('Erro ao verificar premium:', error);
                throw error;
            }
            
            this.isPremium = profile?.is_premium || false;
            console.log(`✅ Status Premium: ${this.isPremium}`);
            
        } catch (error) {
            console.error('❌ Falha ao verificar premium:', error);
            this.isPremium = false;
        }
    }

    async carregarSistemaVisitantes() {
        console.log('📥 Carregando sistema de visitantes...');
        
        if (this.isPremium) {
            await this.carregarVisitantesPremium();
        } else {
            await this.carregarEstatisticasFree();
        }
    }

    async carregarEstatisticasFree() {
        try {
            console.log('🔢 Carregando estatísticas FREE...');
            let visitCount = 0;

            // Estratégia 1: Tentar função RPC
            try {
                const { data: rpcCount, error: rpcError } = await this.supabase.rpc(
                    'count_user_visits', { 
                        p_user_id: this.currentUser.id,
                        p_days: 7 
                    }
                );
                
                if (!rpcError && rpcCount !== null && rpcCount !== undefined) {
                    visitCount = rpcCount;
                    console.log('✅ RPC funcionou:', visitCount);
                } else {
                    throw new Error('RPC retornou erro ou valor inválido');
                }
                
            } catch (rpcError) {
                console.warn('⚠️ RPC falhou, tentando contagem direta:', rpcError);
                
                // Estratégia 2: Contar diretamente da tabela
                const sevenDaysAgo = new Date();
                sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
                
                const { data: visits, error } = await this.supabase
                    .from('profile_visits')
                    .select('id')
                    .eq('visited_id', this.currentUser.id)
                    .gte('visited_at', sevenDaysAgo.toISOString());

                if (!error) {
                    visitCount = visits?.length || 0;
                    console.log('✅ Contagem direta (7 dias):', visitCount);
                } else {
                    console.warn('⚠️ Contagem direta falhou, tentando total:', error);
                    
                    // Estratégia 3: Contar total de visitas
                    const { data: totalVisits, error: totalError } = await this.supabase
                        .from('profile_visits')
                        .select('id', { count: 'exact' })
                        .eq('visited_id', this.currentUser.id);

                    if (!totalError) {
                        visitCount = totalVisits?.length || 0;
                        console.log('✅ Contagem total:', visitCount);
                    }
                }
            }

            this.visitCount = visitCount;
            console.log('🎯 Contador final FREE:', this.visitCount);
            
        } catch (error) {
            console.error('❌ Erro ao carregar estatísticas FREE:', error);
            this.visitCount = 0;
        }
    }

    async carregarVisitantesPremium() {
        try {
            console.log('⭐ Carregando visitantes premium...');
            
            const { data: visits, error } = await this.supabase
                .from('profile_visits')
                .select(`
                    id,
                    visitor_id,
                    visited_at,
                    profiles:visitor_id (
                        id,
                        nickname,
                        full_name,
                        avatar_url,
                        city,
                        last_online_at,
                        is_invisible
                    )
                `)
                .eq('visited_id', this.currentUser.id)
                .order('visited_at', { ascending: false })
                .limit(12);

            if (error) {
                console.error('❌ Erro no carregamento premium:', error);
                throw error;
            }

            console.log(`📊 ${visits?.length || 0} visitas encontradas`);

            // Processar visitantes
            this.visitantes = await this.processarVisitantes(visits || []);
            this.visitCount = this.visitantes.length;
            
            console.log(`✅ ${this.visitantes.length} visitantes processados`);

        } catch (error) {
            console.error('❌ Erro crítico no carregamento premium:', error);
            this.visitantes = [];
            this.visitCount = 0;
        }
    }

    async processarVisitantes(visits) {
        console.log('🔧 Processando visitantes...');
        const visitantesProcessados = [];
        
        for (const visit of visits) {
            try {
                const visitante = await this.criarDadosVisitante(visit);
                if (visitante) {
                    visitantesProcessados.push(visitante);
                }
            } catch (error) {
                console.warn('⚠️ Erro ao processar visitante:', error);
            }
        }

        console.log(`✅ ${visitantesProcessados.length} visitantes processados com sucesso`);
        return visitantesProcessados;
    }

    async criarDadosVisitante(visit) {
        const profile = visit.profiles;
        if (!profile) {
            console.warn('⚠️ Perfil do visitante não encontrado');
            return null;
        }

        try {
            const nickname = profile.nickname || profile.full_name?.split(' ')[0] || 'Usuário';
            const city = profile.city || 'Cidade não informada';
            const timeAgo = this.getTimeAgo(visit.visited_at);
            const initial = nickname.charAt(0).toUpperCase();
            const isOnline = this.isUserOnline(profile);

            // Carregar URL do avatar
            let avatarUrl = null;
            if (profile.avatar_url) {
                avatarUrl = await this.loadUserPhoto(profile.avatar_url);
            }

            return {
                id: visit.visitor_id,
                nickname: nickname,
                city: city,
                timeAgo: timeAgo,
                initial: initial,
                isOnline: isOnline,
                avatarUrl: avatarUrl,
                visited_at: visit.visited_at
            };
        } catch (error) {
            console.error('❌ Erro ao criar dados do visitante:', error);
            return null;
        }
    }

    async registrarVisita(perfilVisitadoId) {
        try {
            console.log(`👀 Tentando registrar visita para: ${perfilVisitadoId}`);
            
            // Validações básicas
            if (!this.currentUser) {
                console.error('❌ Usuário não autenticado');
                return false;
            }
            
            if (perfilVisitadoId === this.currentUser.id) {
                console.log('ℹ️ Não pode visitar próprio perfil');
                return false;
            }

            const visitaData = {
                visitor_id: this.currentUser.id,
                visited_id: perfilVisitadoId,
                visited_at: new Date().toISOString()
            };

            console.log('📤 Enviando dados da visita:', visitaData);

            const { data, error } = await this.supabase
                .from('profile_visits')
                .insert(visitaData)
                .select()
                .single();

            if (error) {
                if (error.code === '23505') {
                    // Visita duplicada - atualizar timestamp
                    console.log('🔄 Visita duplicada, atualizando...');
                    return await this.atualizarVisitaExistente(perfilVisitadoId);
                }
                console.error('❌ Erro ao registrar visita:', error);
                throw error;
            }

            console.log('✅ Visita registrada com sucesso');
            
            // Atualizar contador local se for o próprio usuário
            if (perfilVisitadoId === this.currentUser.id) {
                this.visitCount++;
                this.atualizarUI();
            }
            
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao registrar visita:', error);
            return false;
        }
    }

    async atualizarVisitaExistente(perfilVisitadoId) {
        try {
            const { error } = await this.supabase
                .from('profile_visits')
                .update({ 
                    visited_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('visitor_id', this.currentUser.id)
                .eq('visited_id', perfilVisitadoId);

            if (error) throw error;

            console.log('✅ Visita atualizada com sucesso');
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao atualizar visita:', error);
            return false;
        }
    }

    atualizarUI() {
        console.log('🎨 Atualizando UI do sistema de visitantes...');
        console.log('📊 Dados:', {
            isPremium: this.isPremium,
            visitCount: this.visitCount,
            visitantes: this.visitantes.length,
            initialized: this.initialized
        });

        // Aguardar o DOM estar completamente carregado
        if (document.readyState === 'loading') {
            console.log('⏳ DOM ainda carregando, aguardando...');
            document.addEventListener('DOMContentLoaded', () => this.executarAtualizacaoUI());
        } else {
            this.executarAtualizacaoUI();
        }
    }

    executarAtualizacaoUI() {
        try {
            console.log('🔄 Executando atualização da UI...');
            
            // ✅ CORREÇÃO CRÍTICA: Garantir que elementos existem
            const premiumSection = document.getElementById('premiumVisitors');
            const freeSection = document.getElementById('freeVisitors');
            const freeVisitorsCount = document.getElementById('freeVisitorsCount');
            const visitorsCount = document.getElementById('visitorsCount');
            const visitorsGrid = document.getElementById('visitorsGrid');

            console.log('🔍 Elementos encontrados:', {
                premiumSection: !!premiumSection,
                freeSection: !!freeSection,
                freeVisitorsCount: !!freeVisitorsCount,
                visitorsCount: !!visitorsCount,
                visitorsGrid: !!visitorsGrid
            });

            if (!premiumSection || !freeSection) {
                console.error('❌ Elementos principais da UI não encontrados!');
                console.log('Tentando novamente em 1 segundo...');
                setTimeout(() => this.executarAtualizacaoUI(), 1000);
                return;
            }

            // ✅ CORREÇÃO CRÍTICA: Atualizar contador geral
            if (visitorsCount) {
                const countText = this.visitCount === 1 ? '1 visita' : `${this.visitCount} visitas`;
                visitorsCount.textContent = countText;
                console.log('📊 Visitors count atualizado:', countText);
            }

            // ✅ CORREÇÃO CRÍTICA: Mostrar seção correta
            if (this.isPremium) {
                console.log('🔄 Mostrando seção PREMIUM');
                premiumSection.style.display = 'block';
                freeSection.style.display = 'none';
                
                if (visitorsGrid) {
                    if (this.visitantes.length === 0) {
                        visitorsGrid.innerHTML = this.criarHTMLEstadoVazio();
                        console.log('📭 Mostrando estado vazio para premium');
                    } else {
                        visitorsGrid.innerHTML = this.criarHTMLVisitantes();
                        console.log(`👥 Renderizando ${this.visitantes.length} visitantes`);
                    }
                }
            } else {
                console.log('🔄 Mostrando seção FREE');
                premiumSection.style.display = 'none';
                freeSection.style.display = 'block';
                
                if (freeVisitorsCount) {
                    const countText = this.visitCount === 1 ? '1 pessoa' : `${this.visitCount} pessoas`;
                    freeVisitorsCount.textContent = countText;
                    console.log('🔢 Free visitors count atualizado:', countText);
                }
            }

            console.log('✅ UI atualizada com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro crítico ao atualizar UI:', error);
        }
    }

    criarHTMLVisitantes() {
        console.log('🎨 Criando HTML para visitantes:', this.visitantes.length);
        
        if (this.visitantes.length === 0) {
            return this.criarHTMLEstadoVazio();
        }

        return this.visitantes.map(visitante => `
            <div class="visitor-card" onclick="window.viewProfile('${visitante.id}')">
                <div class="visitor-avatar">
                    ${visitante.avatarUrl ? 
                        `<img class="visitor-avatar-img" src="${visitante.avatarUrl}" alt="${visitante.nickname}" 
                              onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">` :
                        ''
                    }
                    <div class="visitor-avatar-fallback" style="${visitante.avatarUrl ? 'display: none;' : 'display: flex;'}">
                        ${visitante.initial}
                    </div>
                    ${visitante.isOnline ? 
                        '<div class="online-badge" title="Online"></div>' : 
                        '<div class="offline-badge" title="Offline"></div>'
                    }
                </div>
                <div class="visitor-name">${this.escapeHTML(visitante.nickname)}</div>
                <div class="visitor-location">${this.escapeHTML(visitante.city)}</div>
                <div class="visitor-time">${visitante.timeAgo}</div>
            </div>
        `).join('');
    }

    criarHTMLEstadoVazio() {
        return `
            <div class="visitors-empty">
                <div class="icon">👀</div>
                <h3>Nenhuma visita ainda</h3>
                <p>Seu perfil ainda não foi visitado por outros usuários</p>
            </div>
        `;
    }

    // ==================== UTILITÁRIOS ====================
    async loadUserPhoto(avatarUrl) {
        try {
            if (!avatarUrl) return null;
            const { data } = this.supabase.storage.from('avatars').getPublicUrl(avatarUrl);
            return data?.publicUrl || null;
        } catch (error) {
            console.error('❌ Erro ao carregar foto:', error);
            return null;
        }
    }

    isUserOnline(userProfile) {
        if (!userProfile?.last_online_at) return false;
        try {
            const lastOnline = new Date(userProfile.last_online_at);
            const now = new Date();
            const minutesDiff = (now - lastOnline) / (1000 * 60);
            const isActuallyOnline = minutesDiff <= 5;
            
            if (userProfile.id === this.currentUser.id) return true;
            if (userProfile.is_invisible && userProfile.id !== this.currentUser.id) return false;
            return isActuallyOnline;
        } catch (error) {
            return false;
        }
    }

    getTimeAgo(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffInSeconds = Math.floor((now - date) / 1000);
            
            if (diffInSeconds < 60) return 'Agora mesmo';
            else if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`;
            else if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} h`;
            else if (diffInSeconds < 2592000) return `Há ${Math.floor(diffInSeconds / 86400)} dia${Math.floor(diffInSeconds / 86400) !== 1 ? 's' : ''}`;
            else return `Há ${Math.floor(diffInSeconds / 2592000)} mês${Math.floor(diffInSeconds / 2592000) !== 1 ? 'es' : ''}`;
        } catch (error) {
            return 'Recentemente';
        }
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== MÉTODOS PÚBLICOS ====================
    async recarregar() {
        console.log('🔄 Recarregando sistema de visitantes...');
        await this.carregarSistemaVisitantes();
        this.atualizarUI();
    }

    getVisitCount() {
        return this.visitCount;
    }

    isUsuarioPremium() {
        return this.isPremium;
    }

    getVisitantes() {
        return this.visitantes;
    }

    // ✅ NOVO: Atualizar estatísticas para Free users
    async atualizarEstatisticasFree() {
        if (!this.isPremium) {
            await this.carregarEstatisticasFree();
            this.atualizarUI();
        }
    }
}

// ==================== INICIALIZAÇÃO GLOBAL ====================
async function inicializarSistemaVisitantes(supabase, currentUser) {
    console.log('🌐 inicializarSistemaVisitantes CHAMADA!');
    console.log('📡 Supabase:', supabase ? 'OK' : 'FALHO');
    console.log('👤 CurrentUser:', currentUser?.id);

    if (!supabase || !currentUser) {
        console.error('❌ Parâmetros inválidos para inicialização');
        return null;
    }

    try {
        const sistema = new HomeVisitanteSystem(supabase, currentUser);
        await sistema.initialize();
        
        // Expor globalmente para acesso fácil
        window.visitanteSystem = sistema;
        
        console.log('✅ Sistema de visitantes inicializado e exposto globalmente!');
        return sistema;
        
    } catch (error) {
        console.error('❌ Falha crítica na inicialização:', error);
        return null;
    }
}

// ==================== FUNÇÕES GLOBAIS ====================
function registrarVisitaPerfil(perfilVisitadoId) {
    console.log('👀 registrarVisitaPerfil chamada para:', perfilVisitadoId);
    
    if (window.visitanteSystem) {
        return window.visitanteSystem.registrarVisita(perfilVisitadoId);
    } else {
        console.warn('⚠️ Sistema de visitantes não disponível');
        console.error('❌ Não é possível registrar visita sem sistema inicializado');
        return Promise.resolve(false);
    }
}

function recarregarVisitantes() {
    if (window.visitanteSystem) {
        return window.visitanteSystem.recarregar();
    }
    console.warn('⚠️ Sistema de visitantes não disponível para recarregar');
    return Promise.resolve();
}

function getContadorVisitantes() {
    if (window.visitanteSystem) {
        return window.visitanteSystem.getVisitCount();
    }
    return 0;
}

function atualizarEstatisticasVisitantes() {
    if (window.visitanteSystem) {
        return window.visitanteSystem.atualizarEstatisticasFree();
    }
    return Promise.resolve();
}

// ==================== EXPORTAÇÕES GLOBAIS ====================
window.HomeVisitanteSystem = HomeVisitanteSystem;
window.inicializarSistemaVisitantes = inicializarSistemaVisitantes;
window.registrarVisitaPerfil = registrarVisitaPerfil;
window.recarregarVisitantes = recarregarVisitantes;
window.getContadorVisitantes = getContadorVisitantes;
window.atualizarEstatisticasVisitantes = atualizarEstatisticasVisitantes;

console.log('✅ home-visitante.js carregado e pronto!');

// Auto-inicialização quando o DOM estiver pronto
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function() {
        console.log('🏠 DOM carregado - Sistema de visitantes pronto para inicialização');
    });
} else {
    console.log('🏠 DOM já carregado - Sistema de visitantes pronto para inicialização');
}