// home-visitante.js - Sistema Completo de Gerenciamento de Visitantes
class HomeVisitanteSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.visitantes = [];
        this.visitCount = 0;
        this.isPremium = false;
        this.cacheKey = `visitantes_cache_${currentUser?.id}`;
        this.cacheExpiry = 5 * 60 * 1000; // 5 minutos
    }

    // ==================== INICIALIZAÇÃO ====================
    async initialize() {
        try {
            console.log('🚀 Inicializando sistema de visitantes...');
            
            // Verificar status premium
            await this.verificarStatusPremium();
            
            // Carregar dados de visitantes
            await this.carregarSistemaVisitantes();
            
            // Configurar atualizações em tempo real
            this.configurarRealtime();
            
            console.log('✅ Sistema de visitantes inicializado com sucesso');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar sistema de visitantes:', error);
            this.mostrarEstadoErro();
        }
    }

    // ==================== VERIFICAÇÃO DE STATUS PREMIUM ====================
    async verificarStatusPremium() {
        try {
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('is_premium')
                .eq('id', this.currentUser.id)
                .single();

            if (error) throw error;
            
            this.isPremium = profile?.is_premium || false;
            console.log(`🎯 Status Premium: ${this.isPremium}`);
            
        } catch (error) {
            console.error('Erro ao verificar status premium:', error);
            this.isPremium = false;
        }
    }

    // ==================== SISTEMA PRINCIPAL DE VISITANTES ====================
    async carregarSistemaVisitantes() {
        // Tentar carregar do cache primeiro
        if (this.carregarDoCache()) {
            console.log('📦 Dados carregados do cache');
            this.atualizarUI();
            return;
        }

        // Carregar dados frescos do Supabase
        await this.carregarDoSupabase();
    }

    async carregarDoSupabase() {
        try {
            if (this.isPremium) {
                await this.carregarVisitantesPremium();
            } else {
                await this.carregarEstatisticasFree();
            }
            
            // Salvar no cache
            this.salvarNoCache();
            
        } catch (error) {
            console.error('Erro ao carregar do Supabase:', error);
            this.mostrarEstadoErro();
        }
    }

    // ==================== SISTEMA PREMIUM ====================
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
                console.error('Erro ao carregar visitas:', error);
                // Tentar método alternativo
                await this.carregarVisitantesFallback();
                return;
            }

            console.log(`📊 ${visits?.length || 0} visitas encontradas`);

            // Processar visitantes
            this.visitantes = await this.processarVisitantes(visits);
            this.visitCount = this.visitantes.length;

            // Atualizar UI
            this.mostrarVisitantesPremium();
            
        } catch (error) {
            console.error('Erro no carregamento premium:', error);
            await this.carregarVisitantesFallback();
        }
    }

    async processarVisitantes(visits) {
        if (!visits || visits.length === 0) return [];

        const visitantesProcessados = [];
        
        for (const visit of visits) {
            try {
                const visitante = await this.criarDadosVisitante(visit);
                if (visitante) {
                    visitantesProcessados.push(visitante);
                }
            } catch (error) {
                console.warn('Erro ao processar visitante:', error);
            }
        }

        return visitantesProcessados;
    }

    async criarDadosVisitante(visit) {
        const profile = visit.profiles;
        if (!profile) return null;

        const nickname = profile.nickname || profile.full_name?.split(' ')[0] || 'Usuário';
        const city = profile.city || 'Cidade não informada';
        const timeAgo = this.getTimeAgo(visit.visited_at);
        const initial = nickname.charAt(0).toUpperCase();
        const isOnline = this.isUserOnline(profile);

        // Carregar URL da foto
        let avatarUrl = null;
        if (profile.avatar_url) {
            avatarUrl = await this.loadUserPhoto(profile.avatar_url);
        }

        return {
            id: visit.visitor_id,
            visitId: visit.id,
            nickname: nickname,
            city: city,
            timeAgo: timeAgo,
            initial: initial,
            isOnline: isOnline,
            avatarUrl: avatarUrl,
            visitedAt: visit.visited_at
        };
    }

    // ==================== SISTEMA FREE ====================
    async carregarEstatisticasFree() {
        try {
            console.log('🔒 Carregando estatísticas free...');
            
            let visitCount = 0;

            // Método 1: Tentar função RPC
            try {
                const { data: rpcCount, error: rpcError } = await this.supabase.rpc(
                    'count_user_visits', 
                    { 
                        p_user_id: this.currentUser.id,
                        p_days: 7 
                    }
                );
                
                if (!rpcError && rpcCount !== null) {
                    visitCount = rpcCount;
                    console.log(`📈 Contador RPC: ${visitCount} visitas`);
                } else {
                    throw new Error('RPC falhou');
                }
                
            } catch (rpcError) {
                console.warn('RPC falhou, usando contagem direta:', rpcError);
                
                // Método 2: Contar diretamente da tabela
                const { data: visits, error } = await this.supabase
                    .from('profile_visits')
                    .select('id', { count: 'exact' })
                    .eq('visited_id', this.currentUser.id)
                    .gte('visited_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

                if (!error) {
                    visitCount = visits?.length || 0;
                    console.log(`📊 Contagem direta: ${visitCount} visitas`);
                }
            }

            // Método 3: Se ainda zero, tentar contagem total
            if (visitCount === 0) {
                const { data: totalVisits, error } = await this.supabase
                    .from('profile_visits')
                    .select('id', { count: 'exact' })
                    .eq('visited_id', this.currentUser.id);

                if (!error) {
                    visitCount = totalVisits?.length || 0;
                    console.log(`🔢 Contagem total: ${visitCount} visitas`);
                }
            }

            this.visitCount = visitCount;
            this.mostrarEstatisticasFree();
            
        } catch (error) {
            console.error('Erro ao carregar estatísticas free:', error);
            this.visitCount = 0;
            this.mostrarEstatisticasFree();
        }
    }

    // ==================== FALLBACKS ====================
    async carregarVisitantesFallback() {
        try {
            console.log('🔄 Usando fallback para carregar visitantes...');
            
            const { data: visits, error } = await this.supabase
                .from('profile_visits')
                .select('visitor_id, visited_at')
                .eq('visited_id', this.currentUser.id)
                .order('visited_at', { ascending: false })
                .limit(8);

            if (error) throw error;

            this.visitantes = await Promise.all(
                (visits || []).map(async visit => ({
                    id: visit.visitor_id,
                    nickname: 'Usuário',
                    city: '---',
                    timeAgo: this.getTimeAgo(visit.visited_at),
                    initial: '👤',
                    isOnline: false,
                    avatarUrl: null,
                    visitedAt: visit.visited_at
                }))
            );

            this.visitCount = this.visitantes.length;
            this.mostrarVisitantesPremium();
            
        } catch (error) {
            console.error('Erro no fallback:', error);
            this.visitantes = [];
            this.visitCount = 0;
            this.mostrarEstadoVazio();
        }
    }

    // ==================== REGISTRO DE VISITAS ====================
    async registrarVisita(perfilVisitadoId) {
        try {
            // Não registrar se for o próprio usuário
            if (!this.currentUser || perfilVisitadoId === this.currentUser.id) {
                return false;
            }

            console.log(`👀 Registrando visita ao perfil: ${perfilVisitadoId}`);

            const visitaData = {
                visitor_id: this.currentUser.id,
                visited_id: perfilVisitadoId,
                visited_at: new Date().toISOString()
            };

            const { data, error } = await this.supabase
                .from('profile_visits')
                .insert(visitaData)
                .select()
                .single();

            if (error) {
                // Se for erro de duplicidade, tentar atualizar
                if (error.code === '23505') {
                    return await this.atualizarVisitaExistente(perfilVisitadoId);
                }
                throw error;
            }

            console.log('✅ Visita registrada com sucesso:', data);
            
            // Invalidar cache
            this.invalidarCache();
            
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
            this.invalidarCache();
            return true;
            
        } catch (error) {
            console.error('❌ Erro ao atualizar visita:', error);
            return false;
        }
    }

    // ==================== ATUALIZAÇÃO DA UI ====================
    mostrarVisitantesPremium() {
        const premiumSection = document.getElementById('premiumVisitors');
        const freeSection = document.getElementById('freeVisitors');
        const visitorsGrid = document.getElementById('visitorsGrid');
        const visitorsCount = document.getElementById('visitorsCount');

        if (!premiumSection || !freeSection) return;

        // Mostrar seção premium
        premiumSection.style.display = 'block';
        freeSection.style.display = 'none';

        // Atualizar contador
        if (visitorsCount) {
            visitorsCount.textContent = `${this.visitCount} visita${this.visitCount !== 1 ? 's' : ''}`;
        }

        // Atualizar grid
        if (visitorsGrid) {
            if (this.visitantes.length === 0) {
                visitorsGrid.innerHTML = this.criarHTMLEstadoVazio();
            } else {
                visitorsGrid.innerHTML = this.criarHTMLVisitantes();
            }
        }
    }

    mostrarEstatisticasFree() {
        const premiumSection = document.getElementById('premiumVisitors');
        const freeSection = document.getElementById('freeVisitors');
        const freeVisitorsCount = document.getElementById('freeVisitorsCount');
        const visitorsCount = document.getElementById('visitorsCount');

        if (!premiumSection || !freeSection) return;

        // Mostrar seção free
        premiumSection.style.display = 'none';
        freeSection.style.display = 'block';

        // Atualizar contadores
        const countText = this.visitCount === 1 ? '1 pessoa' : `${this.visitCount} pessoas`;
        
        if (freeVisitorsCount) {
            freeVisitorsCount.textContent = countText;
        }
        if (visitorsCount) {
            visitorsCount.textContent = `${this.visitCount} visita${this.visitCount !== 1 ? 's' : ''}`;
        }
    }

    criarHTMLVisitantes() {
        return this.visitantes.map(visitante => `
            <div class="visitor-card" onclick="window.viewProfile('${visitante.id}')">
                <div class="visitor-avatar">
                    ${visitante.avatarUrl ? 
                        `<img class="visitor-avatar-img" src="${visitante.avatarUrl}" alt="${visitante.nickname}">` :
                        `<div class="visitor-avatar-fallback">${visitante.initial}</div>`
                    }
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

    mostrarEstadoErro() {
        const visitorsGrid = document.getElementById('visitorsGrid');
        if (visitorsGrid) {
            visitorsGrid.innerHTML = `
                <div class="visitors-empty">
                    <div class="icon">⚠️</div>
                    <h3>Erro ao carregar</h3>
                    <p>Não foi possível carregar os visitantes</p>
                    <button class="btn btn-primary btn-sm" onclick="window.visitanteSystem.recarregar()">
                        Tentar Novamente
                    </button>
                </div>
            `;
        }
    }

    mostrarEstadoVazio() {
        const visitorsGrid = document.getElementById('visitorsGrid');
        if (visitorsGrid) {
            visitorsGrid.innerHTML = this.criarHTMLEstadoVazio();
        }
    }

    atualizarUI() {
        if (this.isPremium) {
            this.mostrarVisitantesPremium();
        } else {
            this.mostrarEstatisticasFree();
        }
    }

    // ==================== CACHE SYSTEM ====================
    salvarNoCache() {
        try {
            const cacheData = {
                visitantes: this.visitantes,
                visitCount: this.visitCount,
                isPremium: this.isPremium,
                timestamp: Date.now()
            };
            localStorage.setItem(this.cacheKey, JSON.stringify(cacheData));
        } catch (error) {
            console.warn('⚠️ Não foi possível salvar no cache:', error);
        }
    }

    carregarDoCache() {
        try {
            const cached = localStorage.getItem(this.cacheKey);
            if (!cached) return false;

            const cacheData = JSON.parse(cached);
            const isExpired = Date.now() - cacheData.timestamp > this.cacheExpiry;

            if (isExpired) {
                localStorage.removeItem(this.cacheKey);
                return false;
            }

            this.visitantes = cacheData.visitantes || [];
            this.visitCount = cacheData.visitCount || 0;
            this.isPremium = cacheData.isPremium || false;

            return true;
            
        } catch (error) {
            console.warn('⚠️ Erro ao carregar do cache:', error);
            return false;
        }
    }

    invalidarCache() {
        try {
            localStorage.removeItem(this.cacheKey);
        } catch (error) {
            console.warn('⚠️ Erro ao invalidar cache:', error);
        }
    }

    // ==================== REAL-TIME UPDATES ====================
    configurarRealtime() {
        if (!this.isPremium) return;

        try {
            const subscription = this.supabase
                .channel('visitantes-changes')
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'profile_visits',
                        filter: `visited_id=eq.${this.currentUser.id}`
                    },
                    (payload) => {
                        console.log('🔄 Nova visita em tempo real:', payload);
                        this.processarNovaVisita(payload.new);
                    }
                )
                .subscribe();

            console.log('📡 Inscrito em atualizações de visitantes');

            // Limpar subscription quando a página for fechada
            window.addEventListener('beforeunload', () => {
                subscription.unsubscribe();
            });
            
        } catch (error) {
            console.warn('⚠️ Não foi possível configurar real-time:', error);
        }
    }

    async processarNovaVisita(novaVisita) {
        try {
            // Carregar dados do visitante
            const { data: profile, error } = await this.supabase
                .from('profiles')
                .select('*')
                .eq('id', novaVisita.visitor_id)
                .single();

            if (error) throw error;

            const novoVisitante = await this.criarDadosVisitante({
                ...novaVisita,
                profiles: profile
            });

            if (novoVisitante) {
                // Adicionar no início da lista
                this.visitantes.unshift(novoVisitante);
                
                // Manter apenas os últimos 12
                if (this.visitantes.length > 12) {
                    this.visitantes = this.visitantes.slice(0, 12);
                }
                
                this.visitCount = this.visitantes.length;
                
                // Atualizar UI
                this.atualizarUI();
                
                // Mostrar notificação
                this.mostrarNotificacaoVisita(novoVisitante.nickname);
            }
            
        } catch (error) {
            console.error('Erro ao processar nova visita:', error);
        }
    }

    mostrarNotificacaoVisita(nickname) {
        // Criar notificação toast
        const toast = document.createElement('div');
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 12px 20px;
            border-radius: 10px;
            box-shadow: 0 4px 15px rgba(0,0,0,0.2);
            z-index: 10000;
            animation: slideInRight 0.3s ease;
            max-width: 300px;
        `;
        
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px;">
                <span style="font-size: 1.2em;">👀</span>
                <div>
                    <strong>Nova visita!</strong>
                    <div style="font-size: 0.9em; opacity: 0.9;">${this.escapeHTML(nickname)} viu seu perfil</div>
                </div>
            </div>
        `;

        document.body.appendChild(toast);

        // Remover após 5 segundos
        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // ==================== UTILITÁRIOS ====================
    async loadUserPhoto(avatarUrl) {
        try {
            if (!avatarUrl) return null;
            const { data } = this.supabase.storage.from('avatars').getPublicUrl(avatarUrl);
            return data?.publicUrl || null;
        } catch (error) {
            return null;
        }
    }

    isUserOnline(userProfile) {
        if (!userProfile?.last_online_at) return false;
        const lastOnline = new Date(userProfile.last_online_at);
        const now = new Date();
        const minutesDiff = (now - lastOnline) / (1000 * 60);
        const isActuallyOnline = minutesDiff <= 5;
        
        if (userProfile.id === this.currentUser.id) return true;
        if (userProfile.is_invisible && userProfile.id !== this.currentUser.id) return false;
        return isActuallyOnline;
    }

    getTimeAgo(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diffInSeconds = Math.floor((now - date) / 1000);
        
        if (diffInSeconds < 60) return 'Agora mesmo';
        else if (diffInSeconds < 3600) return `Há ${Math.floor(diffInSeconds / 60)} min`;
        else if (diffInSeconds < 86400) return `Há ${Math.floor(diffInSeconds / 3600)} h`;
        else if (diffInSeconds < 2592000) return `Há ${Math.floor(diffInSeconds / 86400)} dia${Math.floor(diffInSeconds / 86400) !== 1 ? 's' : ''}`;
        else return `Há ${Math.floor(diffInSeconds / 2592000)} mês${Math.floor(diffInSeconds / 2592000) !== 1 ? 'es' : ''}`;
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== MÉTODOS PÚBLICOS ====================
    async recarregar() {
        this.invalidarCache();
        await this.carregarSistemaVisitantes();
    }

    async atualizarStatusPremium() {
        await this.verificarStatusPremium();
        await this.recarregar();
    }

    getVisitantes() {
        return this.visitantes;
    }

    getVisitCount() {
        return this.visitCount;
    }

    isUsuarioPremium() {
        return this.isPremium;
    }
}

// ==================== INICIALIZAÇÃO GLOBAL ====================
let visitanteSystem = null;

async function inicializarSistemaVisitantes(supabase, currentUser) {
    if (!supabase || !currentUser) {
        console.error('❌ Supabase ou currentUser não fornecidos');
        return null;
    }

    try {
        visitanteSystem = new HomeVisitanteSystem(supabase, currentUser);
        await visitanteSystem.initialize();
        
        // Expor globalmente
        window.visitanteSystem = visitanteSystem;
        
        return visitanteSystem;
        
    } catch (error) {
        console.error('❌ Falha crítica na inicialização do sistema de visitantes:', error);
        return null;
    }
}

// ==================== FUNÇÕES GLOBAIS ====================
function registrarVisitaPerfil(perfilVisitadoId) {
    if (visitanteSystem) {
        return visitanteSystem.registrarVisita(perfilVisitadoId);
    }
    return Promise.resolve(false);
}

function recarregarVisitantes() {
    if (visitanteSystem) {
        return visitanteSystem.recarregar();
    }
    return Promise.resolve();
}

// ==================== EXPORTAÇÕES ====================
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { HomeVisitanteSystem, inicializarSistemaVisitantes };
}

console.log('✅ home-visitante.js carregado com sucesso!');