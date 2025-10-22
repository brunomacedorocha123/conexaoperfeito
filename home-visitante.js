// home-visitante.js - SISTEMA COMPLETO COM CORREÇÃO URGENTE
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
            
            // 2. Carregar contador de visitas ÚNICAS
            await this.carregarContadorVisitas();
            
            // 3. Se for premium, carregar visitantes ÚNICOS
            if (this.isPremium) {
                await this.carregarVisitantesPremium();
            }
            
            // 4. Atualizar UI
            this.atualizarUI();
            
            this.initialized = true;
            console.log('✅ Sistema de visitantes inicializado!');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar:', error);
            this.visitCount = 0;
            this.atualizarUI();
        }
    }

    async verificarStatusPremium() {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', this.currentUser.id)
                .single();

            if (error) throw error;
            
            this.isPremium = profile?.is_premium || false;
            console.log(`✅ Status Premium: ${this.isPremium}`);
            
        } catch (error) {
            console.error('❌ Falha ao verificar premium:', error);
            this.isPremium = false;
        }
    }

    async carregarContadorVisitas() {
        try {
            console.log('🔢 Carregando contador de visitas ÚNICAS...');
            
            // Estratégia 1: Tentar função RPC de visitas únicas
            try {
                const { data: rpcCount, error: rpcError } = await this.supabase.rpc(
                    'count_unique_visits', { 
                        p_user_id: this.currentUser.id,
                        p_days: 7 
                    }
                );
                
                if (!rpcError && rpcCount !== null) {
                    this.visitCount = rpcCount;
                    console.log('✅ RPC visitas únicas:', this.visitCount);
                    return;
                }
            } catch (rpcError) {
                console.warn('⚠️ RPC falhou, tentando contagem direta');
            }
            
            // Estratégia 2: Contar visitantes únicos diretamente
            const { data: visits, error } = await this.supabase
                .from('profile_visits')
                .select('visitor_id')
                .eq('visited_id', this.currentUser.id);

            if (!error) {
                // Usar Set para contar visitantes únicos
                const uniqueVisitors = new Set(visits?.map(v => v.visitor_id) || []);
                this.visitCount = uniqueVisitors.size;
                console.log('✅ Contagem direta visitantes únicos:', this.visitCount);
            } else {
                this.visitCount = 0;
            }
            
        } catch (error) {
            console.error('❌ Erro ao carregar contador:', error);
            this.visitCount = 0;
        }
    }

    async carregarVisitantesPremium() {
        try {
            console.log('⭐ Carregando visitantes premium ÚNICOS...');
            
            // Estratégia 1: Usar função RPC otimizada (SEM DUPLICATAS)
            try {
                const { data: visitors, error } = await this.supabase.rpc(
                    'get_recent_visitors', {
                        p_user_id: this.currentUser.id,
                        p_limit: 12
                    }
                );

                if (!error && visitors) {
                    this.visitantes = await this.processarVisitantesRPC(visitors);
                    console.log(`✅ RPC visitors únicos: ${this.visitantes.length}`);
                    return;
                }
            } catch (rpcError) {
                console.warn('⚠️ RPC falhou, usando query direta:', rpcError);
            }

            // Estratégia 2: Query direta CORRIGIDA (SEM DUPLICATAS)
            const { data: visits, error } = await this.supabase
                .from('profile_visits')
                .select(`
                    visitor_id,
                    visited_at,
                    profiles:visitor_id (
                        id,
                        nickname,
                        full_name,
                        avatar_url,
                        city,
                        state,
                        last_online_at,
                        is_invisible
                    )
                `)
                .eq('visited_id', this.currentUser.id)
                .order('visited_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            // ✅ CORREÇÃO CRÍTICA: REMOVER DUPLICATAS
            this.visitantes = await this.removerVisitantesDuplicados(visits || []);
            console.log(`✅ Visitantes únicos carregados: ${this.visitantes.length}`);

        } catch (error) {
            console.error('❌ Erro ao carregar visitantes premium:', error);
            this.visitantes = [];
        }
    }

    async removerVisitantesDuplicados(visits) {
        const visitantesUnicos = new Map();
        
        for (const visit of visits) {
            try {
                const visitorId = visit.visitor_id;
                const profile = visit.profiles;
                
                if (!profile) continue;

                // Se já existe este visitante, mantém apenas o mais recente
                const existingVisit = visitantesUnicos.get(visitorId);
                if (!existingVisit || new Date(visit.visited_at) > new Date(existingVisit.visited_at)) {
                    const nickname = profile.nickname || profile.full_name?.split(' ')[0] || 'Usuário';
                    const city = profile.city || 'Cidade não informada';
                    const timeAgo = this.getTimeAgo(visit.visited_at);
                    const initial = nickname.charAt(0).toUpperCase();
                    
                    // ✅ CORREÇÃO: USAR MESMA LÓGICA DE STATUS ONLINE DOS CARDS GRANDES
                    const isOnline = this.isUserOnline(profile, this.currentUser.id);
                    
                    let avatarUrl = null;
                    if (profile.avatar_url) {
                        avatarUrl = await this.loadUserPhoto(profile.avatar_url);
                    }

                    visitantesUnicos.set(visitorId, {
                        id: visitorId,
                        nickname: nickname,
                        city: city,
                        timeAgo: timeAgo,
                        initial: initial,
                        isOnline: isOnline,
                        avatarUrl: avatarUrl,
                        visited_at: visit.visited_at,
                        last_online_at: profile.last_online_at,
                        is_invisible: profile.is_invisible
                    });
                }
            } catch (error) {
                console.warn('⚠️ Erro ao processar visitante:', error);
            }
        }

        return Array.from(visitantesUnicos.values())
            .sort((a, b) => new Date(b.visited_at) - new Date(a.visited_at))
            .slice(0, 12);
    }

    async processarVisitantesRPC(visitors) {
        const visitantesProcessados = [];
        
        for (const visitor of visitors) {
            try {
                // ✅ CORREÇÃO: APLICAR MESMA LÓGICA DE STATUS ONLINE
                const isOnline = this.isUserOnline({
                    last_online_at: visitor.last_online_at,
                    is_invisible: visitor.is_invisible,
                    id: visitor.visitor_id
                }, this.currentUser.id);
                
                const visitante = {
                    id: visitor.visitor_id,
                    nickname: visitor.visitor_nickname,
                    city: visitor.visitor_city,
                    timeAgo: this.getTimeAgo(visitor.visited_at),
                    initial: visitor.visitor_nickname?.charAt(0).toUpperCase() || 'U',
                    isOnline: isOnline,
                    isInvisible: visitor.is_invisible,
                    avatarUrl: visitor.visitor_avatar_url ? 
                        await this.loadUserPhoto(visitor.visitor_avatar_url) : null,
                    visited_at: visitor.visited_at,
                    last_online_at: visitor.last_online_at
                };
                
                visitantesProcessados.push(visitante);
            } catch (error) {
                console.warn('⚠️ Erro ao processar visitante RPC:', error);
            }
        }

        return visitantesProcessados;
    }

    isUserOnline(userProfile, currentUserId) {
        if (!userProfile.last_online_at) return false;
        
        try {
            const lastOnline = new Date(userProfile.last_online_at);
            const now = new Date();
            const minutesDiff = (now - lastOnline) / (1000 * 60);
            const isActuallyOnline = minutesDiff <= 5;
            
            // ✅ MESMA LÓGICA DOS CARDS GRANDES
            if (userProfile.id === currentUserId) return true;
            if (userProfile.is_invisible && userProfile.id !== currentUserId) return false;
            
            return isActuallyOnline;
        } catch (error) {
            console.warn('⚠️ Erro ao verificar status online:', error);
            return false;
        }
    }

    atualizarUI() {
        console.log('🎨 Atualizando UI do sistema de visitantes...');
        
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.executarAtualizacaoUI());
        } else {
            setTimeout(() => this.executarAtualizacaoUI(), 100);
        }
    }

    executarAtualizacaoUI() {
        try {
            console.log('🔄 Executando atualização da UI...');
            
            const premiumSection = document.getElementById('premiumVisitors');
            const freeSection = document.getElementById('freeVisitors');
            const freeVisitorsCount = document.getElementById('freeVisitorsCount');
            const visitorsCount = document.getElementById('visitorsCount');
            const visitorsGrid = document.getElementById('visitorsGrid');

            console.log('🔍 Elementos encontrados:', {
                premiumSection: !!premiumSection,
                freeSection: !!freeSection,
                visitorsCount: !!visitorsCount,
                visitorsGrid: !!visitorsGrid
            });

            if (!premiumSection || !freeSection) {
                console.error('❌ Elementos da UI não encontrados!');
                return;
            }

            // ✅ ATUALIZAR CONTADOR GERAL
            if (visitorsCount) {
                const countText = this.visitCount === 1 ? '1 visita' : `${this.visitCount} visitas`;
                visitorsCount.textContent = countText;
            }

            // ✅ MOSTRAR SEÇÃO CORRETA
            if (this.isPremium) {
                console.log('🔄 Mostrando seção PREMIUM');
                premiumSection.style.display = 'block';
                freeSection.style.display = 'none';
                
                if (visitorsGrid) {
                    if (this.visitantes.length === 0) {
                        visitorsGrid.innerHTML = this.criarHTMLEstadoVazio();
                    } else {
                        visitorsGrid.innerHTML = this.criarHTMLVisitantes();
                    }
                }
            } else {
                console.log('🔄 Mostrando seção FREE');
                premiumSection.style.display = 'none';
                freeSection.style.display = 'block';
                
                if (freeVisitorsCount) {
                    const countText = this.visitCount === 1 ? '1 pessoa' : `${this.visitCount} pessoas`;
                    freeVisitorsCount.textContent = countText;
                }
            }

            console.log('✅ UI atualizada com sucesso!');
            
        } catch (error) {
            console.error('❌ Erro crítico ao atualizar UI:', error);
        }
    }

    // ✅✅✅ CORREÇÃO URGENTE: HTML DOS VISITANTES COM BADGES
    criarHTMLVisitantes() {
        if (this.visitantes.length === 0) {
            return this.criarHTMLEstadoVazio();
        }

        console.log('🎯 Gerando HTML dos visitantes:', this.visitantes);

        return this.visitantes.map(visitante => {
            console.log(`👤 Visitante ${visitante.nickname}: online=${visitante.isOnline}`);
            
            // ✅ CORREÇÃO URGENTE: FORÇAR BADGE ONLINE/OFFLINE
            const badgeHTML = visitante.isOnline ? 
                '<div class="online-badge" title="Online"></div>' : 
                '<div class="offline-badge" title="Offline"></div>';
            
            return `
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
                    ${badgeHTML}
                </div>
                <div class="visitor-name">${this.escapeHTML(visitante.nickname)}</div>
                <div class="visitor-location">${this.escapeHTML(visitante.city)}</div>
                <div class="visitor-time">${visitante.timeAgo}</div>
            </div>
            `;
        }).join('');
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

    async registrarVisita(perfilVisitadoId) {
        try {
            console.log(`👀 Registrando visita para: ${perfilVisitadoId}`);
            
            if (!this.currentUser || perfilVisitadoId === this.currentUser.id) {
                return false;
            }

            const { data, error } = await this.supabase.rpc(
                'register_visit_simple', {
                    p_visitor_id: this.currentUser.id,
                    p_visited_id: perfilVisitadoId
                }
            );

            if (error) {
                console.error('❌ Erro RPC:', error);
                return await this.registrarVisitaFallback(perfilVisitadoId);
            }

            console.log('✅ Visita registrada:', data);
            return data?.success || false;
            
        } catch (error) {
            console.error('❌ Erro ao registrar visita:', error);
            return false;
        }
    }

    async registrarVisitaFallback(perfilVisitadoId) {
        try {
            const { error } = await this.supabase
                .from('profile_visits')
                .upsert({
                    visitor_id: this.currentUser.id,
                    visited_id: perfilVisitadoId,
                    visited_at: new Date().toISOString(),
                    visit_date: new Date().toISOString().split('T')[0]
                }, {
                    onConflict: 'visitor_id,visited_id,visit_date',
                    ignoreDuplicates: false
                });

            return !error;
        } catch (error) {
            console.error('❌ Erro no fallback:', error);
            return false;
        }
    }

    async loadUserPhoto(avatarUrl) {
        try {
            if (!avatarUrl) return null;
            const { data } = this.supabase.storage.from('avatars').getPublicUrl(avatarUrl);
            return data?.publicUrl || null;
        } catch (error) {
            return null;
        }
    }

    getTimeAgo(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffMins = Math.floor(diffMs / 60000);
            const diffHours = Math.floor(diffMs / 3600000);
            const diffDays = Math.floor(diffMs / 86400000);
            
            if (diffMins < 1) return 'Agora mesmo';
            if (diffMins < 60) return `${diffMins} min`;
            if (diffHours < 24) return `${diffHours} h`;
            if (diffDays < 7) return `${diffDays} dia${diffDays !== 1 ? 's' : ''}`;
            return `${Math.floor(diffDays / 7)} semana${Math.floor(diffDays / 7) !== 1 ? 's' : ''}`;
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

    async recarregar() {
        console.log('🔄 Recarregando sistema de visitantes...');
        await this.carregarContadorVisitas();
        if (this.isPremium) {
            await this.carregarVisitantesPremium();
        }
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
}

// ==================== INICIALIZAÇÃO GLOBAL ====================
async function inicializarSistemaVisitantes(supabase, currentUser) {
    console.log('🌐 inicializarSistemaVisitantes CHAMADA!');
    
    if (!supabase || !currentUser) {
        console.error('❌ Parâmetros inválidos para inicialização');
        return null;
    }

    try {
        const sistema = new HomeVisitanteSystem(supabase, currentUser);
        await sistema.initialize();
        
        window.visitanteSystem = sistema;
        
        console.log('✅ Sistema de visitantes inicializado e exposto globalmente!');
        return sistema;
        
    } catch (error) {
        console.error('❌ Falha crítica na inicialização:', error);
        return null;
    }
}

function registrarVisitaPerfil(perfilVisitadoId) {
    console.log('👀 registrarVisitaPerfil chamada para:', perfilVisitadoId);
    
    if (window.visitanteSystem) {
        return window.visitanteSystem.registrarVisita(perfilVisitadoId);
    } else {
        console.warn('⚠️ Sistema de visitantes não disponível');
        return Promise.resolve(false);
    }
}

function recarregarVisitantes() {
    if (window.visitanteSystem) {
        return window.visitanteSystem.recarregar();
    }
    return Promise.resolve();
}

function getContadorVisitantes() {
    if (window.visitanteSystem) {
        return window.visitanteSystem.getVisitCount();
    }
    return 0;
}

window.HomeVisitanteSystem = HomeVisitanteSystem;
window.inicializarSistemaVisitantes = inicializarSistemaVisitantes;
window.registrarVisitaPerfil = registrarVisitaPerfil;
window.recarregarVisitantes = recarregarVisitantes;
window.getContadorVisitantes = getContadorVisitantes;

console.log('✅ home-visitante.js carregado e pronto!');