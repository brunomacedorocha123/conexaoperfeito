// home-stats.js
class HomeStatsSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
    }

    async initialize() {
        await this.updateStats();
        this.startOnlineStatusUpdater();
        
        // Atualizar stats periodicamente
        setInterval(() => this.updateStats(), 60000); // A cada 1 minuto
    }

    async updateStats() {
        // Inicializar com valores padrão
        this.setStatValue('totalUsers', '...');
        this.setStatValue('newMatches', '0');
        this.setStatValue('usersOnline', '...');
        this.setStatValue('profileViews', '...');

        try {
            const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
            
            // Executar todas as consultas em paralelo
            const [totalResult, messagesResult, onlineResult] = await Promise.all([
                this.supabase.from('profiles').select('*', { count: 'exact', head: true }),
                this.supabase.from('messages').select('*', { count: 'exact', head: true })
                    .eq('receiver_id', this.currentUser.id)
                    .eq('is_read', false),
                this.supabase.from('profiles').select('*', { count: 'exact', head: true })
                    .gte('last_online_at', fiveMinutesAgo)
                    .eq('is_invisible', false)
                    .neq('id', this.currentUser.id)
            ]);

            // Atualizar a interface
            this.setStatValue('totalUsers', totalResult.count || 1);
            this.setStatValue('newMatches', messagesResult.count || 0);
            this.setStatValue('usersOnline', onlineResult.count || 0);
            
            // ✅ CORREÇÃO: VISUALIZAÇÕES DO SISTEMA DE VISITANTES
            await this.updateProfileViews();
            
            console.log('📊 Stats atualizados:', {
                total: totalResult.count || 1,
                matches: messagesResult.count || 0,
                online: onlineResult.count || 0
            });

        } catch (error) {
            console.error('❌ Erro ao carregar estatísticas:', error);
            // Valores fallback
            this.setStatValue('totalUsers', '1');
            this.setStatValue('newMatches', '0');
            this.setStatValue('usersOnline', '0');
            this.setStatValue('profileViews', '0');
        }
    }

    // Atualizar visualizações do perfil
    async updateProfileViews() {
        try {
            let visitCount = 0;
            
            // Tentar usar sistema de visitantes se disponível
            if (window.visitanteSystem && typeof window.visitanteSystem.getVisitCount === 'function') {
                visitCount = window.visitanteSystem.getVisitCount();
                console.log('📊 Visualizações do perfil (sistema):', visitCount);
            } else {
                // Fallback: contar diretamente
                const { data: visits, error } = await this.supabase
                    .from('profile_visits')
                    .select('id', { count: 'exact' })
                    .eq('visited_id', this.currentUser.id);

                visitCount = visits?.length || 0;
                console.log('📊 Visualizações (fallback):', visitCount);
            }
            
            this.setStatValue('profileViews', visitCount);
            
        } catch (error) {
            console.error('❌ Erro ao carregar visualizações:', error);
            this.setStatValue('profileViews', '0');
        }
    }

    // Definir valor de uma estatística
    setStatValue(statId, value) {
        const element = document.getElementById(statId);
        if (element) {
            element.textContent = value;
        }
    }

    // ==================== SISTEMA DE STATUS ONLINE ====================

    async updateOnlineStatus() {
        try {
            const { error } = await this.supabase
                .from('profiles')
                .update({ 
                    last_online_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                })
                .eq('id', this.currentUser.id);
                
            if (error) {
                console.warn('⚠️ Erro ao atualizar status online:', error);
            }
        } catch (error) {
            console.error('❌ Erro crítico ao atualizar status:', error);
        }
    }

    startOnlineStatusUpdater() {
        // Atualizar imediatamente
        this.updateOnlineStatus();
        
        // Atualizar a cada minuto
        setInterval(() => this.updateOnlineStatus(), 60000);
        
        // Atualizar quando a página ficar visível
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) this.updateOnlineStatus();
        });
        
        // Atualizar em interações do usuário
        ['click', 'mousemove', 'keypress', 'scroll'].forEach(event => {
            document.addEventListener(event, () => this.updateOnlineStatus(), { passive: true });
        });
    }

    // Obter estatísticas atuais (para outros sistemas)
    getCurrentStats() {
        return {
            totalUsers: document.getElementById('totalUsers')?.textContent || '0',
            newMatches: document.getElementById('newMatches')?.textContent || '0',
            usersOnline: document.getElementById('usersOnline')?.textContent || '0',
            profileViews: document.getElementById('profileViews')?.textContent || '0'
        };
    }
}

// Inicializar quando o script carregar
let statsSystem = null;

function initializeStatsSystem(supabase, currentUser) {
    statsSystem = new HomeStatsSystem(supabase, currentUser);
    return statsSystem.initialize();
}