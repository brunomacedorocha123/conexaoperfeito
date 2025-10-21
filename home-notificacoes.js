// home-notificacoes.js
class HomeNotificationsSystem {
    constructor(supabase, currentUser) {
        this.supabase = supabase;
        this.currentUser = currentUser;
        this.unreadCount = 0;
    }

    async initialize() {
        await this.updateNotificationBadge();
        this.setupRealTimeListener();
        
        // Atualizar a cada 30 segundos
        setInterval(() => this.updateNotificationBadge(), 30000);
        
        // Criar notificação de boas-vindas (opcional)
        setTimeout(() => this.createSampleNotification(), 2000);
    }

    // Função para atualizar o badge de notificações
    async updateNotificationBadge() {
        try {
            if (!this.currentUser) return;
            
            const { data: notifications, error } = await this.supabase
                .from('user_notifications')
                .select('id')
                .eq('user_id', this.currentUser.id)
                .eq('is_read', false);

            if (error) {
                console.log('ℹ️ Tabela de notificações não encontrada, usando sistema padrão');
                return;
            }

            this.unreadCount = notifications?.length || 0;
            this.updateBadgeUI();
            
            // Salvar no localStorage para acesso rápido
            localStorage.setItem('unreadNotifications', this.unreadCount);

        } catch (error) {
            console.error('Erro ao atualizar badge:', error);
        }
    }

    // Atualizar interface do badge
    updateBadgeUI() {
        // Atualizar badges
        const badges = document.querySelectorAll('.notification-badge');
        badges.forEach(badge => {
            if (this.unreadCount > 0) {
                badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
                badge.style.display = 'flex';
                
                // Adicionar classe se tiver muitas notificações
                if (this.unreadCount > 9) {
                    badge.classList.add('high-count');
                } else {
                    badge.classList.remove('high-count');
                }
            } else {
                badge.textContent = '0';
                badge.style.display = 'none';
            }
        });

        // Atualizar sino
        const bell = document.getElementById('notificationBell');
        if (bell) {
            if (this.unreadCount > 0) {
                bell.classList.add('has-notifications');
            } else {
                bell.classList.remove('has-notifications');
            }
        }
    }

    // Configurar listener em tempo real
    setupRealTimeListener() {
        try {
            const subscription = this.supabase
                .channel('notifications-badge')
                .on('postgres_changes', 
                    { 
                        event: '*', 
                        schema: 'public', 
                        table: 'user_notifications',
                        filter: `user_id=eq.${this.currentUser.id}`
                    }, 
                    () => {
                        this.updateNotificationBadge();
                    }
                )
                .subscribe();
        } catch (error) {
            console.log('ℹ️ Sistema em tempo real não disponível');
        }
    }

    // Criar notificação de exemplo (para teste)
    async createSampleNotification() {
        try {
            const notificationData = {
                user_id: this.currentUser.id,
                type: 'welcome',
                title: 'Bem-vindo ao Amor Conect! 🎉',
                message: 'Sua jornada para encontrar conexões genuínas começou. Complete seu perfil para ter mais matches!',
                priority: 'high',
                actions: [
                    { label: 'Completar Perfil', type: 'primary' },
                    { label: 'Ver Dicas', type: 'secondary' }
                ],
                created_at: new Date().toISOString()
            };

            const { error } = await this.supabase
                .from('user_notifications')
                .insert(notificationData);

            if (error && error.code !== '23505') { // Ignora erro de duplicação
                console.log('ℹ️ Não foi possível criar notificação de exemplo');
            }
        } catch (error) {
            // Tabela não existe ainda, tudo bem
        }
    }

    // Obter contagem atual (para outros sistemas)
    getUnreadCount() {
        return this.unreadCount;
    }
}

// Inicializar quando o script carregar
let notificationsSystem = null;

function initializeNotificationsSystem(supabase, currentUser) {
    notificationsSystem = new HomeNotificationsSystem(supabase, currentUser);
    return notificationsSystem.initialize();
}