// home-visitante.js - Sistema Completo de Gerenciamento de Visitantes
console.log('🚀 home-visitante.js carregando...');

class HomeVisitanteSystem {
    constructor(supabase, currentUser) {
        console.log('🔧 Construtor do VisitanteSystem');
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.visitantes = [];
        this.visitCount = 0;
        this.isPremium = false;
    }

    async initialize() {
        try {
            console.log('🎯 Inicializando sistema de visitantes...');
            
            await this.verificarStatusPremium();
            await this.carregarSistemaVisitantes();
            
            console.log('✅ Sistema de visitantes pronto');
            
        } catch (error) {
            console.error('❌ Erro ao inicializar:', error);
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
            console.log(`⭐ Status Premium: ${this.isPremium}`);
            
        } catch (error) {
            console.error('Erro ao verificar premium:', error);
            this.isPremium = false;
        }
    }

    async carregarSistemaVisitantes() {
        if (this.isPremium) {
            await this.carregarVisitantesPremium();
        } else {
            await this.carregarEstatisticasFree();
        }
        this.atualizarUI();
    }

    async carregarEstatisticasFree() {
        try {
            console.log('🔢 Carregando estatísticas FREE...');
            let visitCount = 0;

            // Tentar função RPC
            try {
                const { data: rpcCount, error: rpcError } = await this.supabase.rpc(
                    'count_user_visits', { 
                        p_user_id: this.currentUser.id,
                        p_days: 7 
                    }
                );
                
                if (!rpcError && rpcCount !== null) {
                    visitCount = rpcCount;
                    console.log('✅ RPC funcionou:', visitCount);
                } else {
                    throw new Error('RPC falhou');
                }
                
            } catch (rpcError) {
                console.warn('⚠️ RPC falhou, tentando contagem direta');
                
                // Fallback: contar diretamente
                const { data: visits, error } = await this.supabase
                    .from('profile_visits')
                    .select('id')
                    .eq('visited_id', this.currentUser.id)
                    .gte('visited_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString());

                if (!error) {
                    visitCount = visits?.length || 0;
                    console.log('✅ Contagem direta:', visitCount);
                }
            }

            // Último fallback
            if (visitCount === 0) {
                const { data: totalVisits, error } = await this.supabase
                    .from('profile_visits')
                    .select('id', { count: 'exact' })
                    .eq('visited_id', this.currentUser.id);

                if (!error) {
                    visitCount = totalVisits?.length || 0;
                    console.log('✅ Contagem total:', visitCount);
                }
            }

            this.visitCount = visitCount;
            console.log('🎯 Contador final:', this.visitCount);
            
        } catch (error) {
            console.error('❌ Erro ao carregar estatísticas:', error);
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

            if (error) throw error;

            console.log(`📊 ${visits?.length || 0} visitas encontradas`);

            this.visitantes = await this.processarVisitantes(visits || []);
            this.visitCount = this.visitantes.length;

        } catch (error) {
            console.error('❌ Erro no carregamento premium:', error);
            this.visitantes = [];
            this.visitCount = 0;
        }
    }

    async processarVisitantes(visits) {
        const visitantesProcessados = [];
        
        for (const visit of visits) {
            try {
                const visitante = await this.criarDadosVisitante(visit);
                if (visitante) visitantesProcessados.push(visitante);
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
            avatarUrl: avatarUrl
        };
    }

    async registrarVisita(perfilVisitadoId) {
        try {
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
                if (error.code === '23505') {
                    return await this.atualizarVisitaExistente(perfilVisitadoId);
                }
                throw error;
            }

            console.log('✅ Visita registrada com sucesso');
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
        console.log('🎨 Atualizando UI...', {
            isPremium: this.isPremium,
            visitCount: this.visitCount
        });

        const premiumSection = document.getElementById('premiumVisitors');
        const freeSection = document.getElementById('freeVisitors');
        const freeVisitorsCount = document.getElementById('freeVisitorsCount');
        const visitorsCount = document.getElementById('visitorsCount');

        if (!premiumSection || !freeSection) {
            console.error('❌ Elementos da UI não encontrados!');
            return;
        }

        if (this.isPremium) {
            premiumSection.style.display = 'block';
            freeSection.style.display = 'none';
            
            const visitorsGrid = document.getElementById('visitorsGrid');
            if (visitorsGrid) {
                if (this.visitantes.length === 0) {
                    visitorsGrid.innerHTML = this.criarHTMLEstadoVazio();
                } else {
                    visitorsGrid.innerHTML = this.criarHTMLVisitantes();
                }
            }
        } else {
            premiumSection.style.display = 'none';
            freeSection.style.display = 'block';
            
            const countText = this.visitCount === 1 ? '1 pessoa' : `${this.visitCount} pessoas`;
            if (freeVisitorsCount) freeVisitorsCount.textContent = countText;
        }

        if (visitorsCount) {
            visitorsCount.textContent = `${this.visitCount} visita${this.visitCount !== 1 ? 's' : ''}`;
        }

        console.log('✅ UI atualizada com sucesso!');
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
        else return `Há ${Math.floor(diffInSeconds / 86400)} dia${Math.floor(diffInSeconds / 86400) !== 1 ? 's' : ''}`;
    }

    escapeHTML(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // ==================== MÉTODOS PÚBLICOS ====================
    async recarregar() {
        await this.carregarSistemaVisitantes();
    }

    getVisitCount() {
        return this.visitCount;
    }

    isUsuarioPremium() {
        return this.isPremium;
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
        
        // Expor globalmente
        window.visitanteSystem = sistema;
        
        console.log('✅ Sistema de visitantes inicializado!');
        return sistema;
        
    } catch (error) {
        console.error('❌ Falha crítica na inicialização:', error);
        return null;
    }
}

// ==================== FUNÇÕES GLOBAIS ====================
function registrarVisitaPerfil(perfilVisitadoId) {
    console.log('👀 Tentando registrar visita para:', perfilVisitadoId);
    
    if (window.visitanteSystem) {
        return window.visitanteSystem.registrarVisita(perfilVisitadoId);
    }
    console.warn('⚠️ Sistema de visitantes não disponível');
    return Promise.resolve(false);
}

function recarregarVisitantes() {
    if (window.visitanteSystem) {
        return window.visitanteSystem.recarregar();
    }
    return Promise.resolve();
}

// ==================== EXPORTAÇÕES GLOBAIS ====================
window.HomeVisitanteSystem = HomeVisitanteSystem;
window.inicializarSistemaVisitantes = inicializarSistemaVisitantes;
window.registrarVisitaPerfil = registrarVisitaPerfil;
window.recarregarVisitantes = recarregarVisitantes;

console.log('✅ home-visitante.js carregado com sucesso!');