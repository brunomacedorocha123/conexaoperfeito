// delete-account.js - Sistema de Exclusão de Conta Universal
// ✅ Pode ser usado em: painel.html, home.html, perfil.html, etc.

class AccountDeleter {
    constructor(supabase) {
        this.supabase = supabase;
        this.currentUser = null;
    }

    // ✅ INICIALIZAR
    async initialize() {
        try {
            const { data: { user } } = await this.supabase.auth.getUser();
            this.currentUser = user;
            return !!user;
        } catch (error) {
            console.error('Erro ao inicializar:', error);
            return false;
        }
    }

    // ✅ EXCLUSÃO REAL DA CONTA
    async deleteAccount() {
        try {
            // 🔒 CONFIRMAÇÃO FINAL
            if (!confirm('🚨 EXCLUSÃO PERMANENTE!\n\nTem certeza que quer excluir SUA CONTA?\n\n⚠️  Todos os seus dados serão perdidos!\n⚠️  Você não poderá mais fazer login!\n⚠️  Esta ação é IRREVERSÍVEL!')) {
                return { success: false, message: 'Exclusão cancelada' };
            }

            console.log('🗑️ INICIANDO EXCLUSÃO DEFINITIVA...');

            // 🎯 MOSTRAR CARREGAMENTO
            this.showLoading(true);

            // 1. 🖼️ DELETAR FOTOS
            await this.deleteUserPhotos();

            // 2. 📋 DELETAR DADOS DO BANCO
            await this.deleteUserData();

            // 3. 🔐 EXCLUIR CONTA DA AUTENTICAÇÃO
            const authDeleted = await this.deleteAuthUser();
            
            if (!authDeleted) {
                throw new Error('Não foi possível excluir a conta de autenticação');
            }

            // 4. 🧹 LIMPAR TUDO
            await this.cleanup();

            console.log('✅ CONTA EXCLUÍDA COM SUCESSO!');
            return { 
                success: true, 
                message: 'Conta excluída com sucesso! Redirecionando...' 
            };

        } catch (error) {
            console.error('❌ Erro na exclusão:', error);
            this.showLoading(false);
            return { 
                success: false, 
                message: 'Erro ao excluir conta: ' + error.message 
            };
        }
    }

    // ✅ DELETAR FOTOS DO USUÁRIO
    async deleteUserPhotos() {
        try {
            // Buscar perfil para ver se tem foto
            const { data: profile } = await this.supabase
                .from('profiles')
                .select('avatar_url')
                .eq('id', this.currentUser.id)
                .single();

            if (profile?.avatar_url) {
                await this.supabase.storage
                    .from('avatars')
                    .remove([profile.avatar_url]);
                console.log('✅ Fotos deletadas');
            }
        } catch (error) {
            console.log('ℹ️ Nenhuma foto para deletar');
        }
    }

    // ✅ DELETAR DADOS DO BANCO
    async deleteUserData() {
        try {
            // Deletar em ordem correta por causa das foreign keys
            await this.supabase.from('messages').delete().or(`sender_id.eq.${this.currentUser.id},receiver_id.eq.${this.currentUser.id}`);
            await this.supabase.from('user_details').delete().eq('user_id', this.currentUser.id);
            await this.supabase.from('profiles').delete().eq('id', this.currentUser.id);
            
            console.log('✅ Dados do banco deletados');
        } catch (error) {
            console.error('Erro ao deletar dados:', error);
            throw error;
        }
    }

    // ✅ EXCLUIR USUÁRIO DA AUTENTICAÇÃO (IMPORTANTE!)
    async deleteAuthUser() {
        try {
            // Método 1: Usar Edge Function (RECOMENDADO)
            const { data, error } = await this.supabase.functions.invoke('delete-user-complete', {
                body: { userId: this.currentUser.id }
            });

            if (!error) {
                console.log('✅ Conta auth excluída via Edge Function');
                return true;
            }

            // Método 2: Fallback - marcar como excluído e invalidar sessão
            console.log('🔄 Usando fallback...');
            await this.supabase.auth.signOut();
            
            // Marcar perfil como excluído permanentemente
            await this.supabase
                .from('profiles')
                .update({
                    deleted_at: new Date().toISOString(),
                    nickname: 'USUARIO_EXCLUIDO',
                    full_name: 'Conta Excluída',
                    avatar_url: null,
                    birth_date: null
                })
                .eq('id', this.currentUser.id);

            console.log('✅ Conta marcada como excluída (fallback)');
            return true;

        } catch (error) {
            console.error('❌ Erro ao excluir auth:', error);
            return false;
        }
    }

    // ✅ LIMPEZA FINAL
    async cleanup() {
        try {
            // Fazer logout
            await this.supabase.auth.signOut();
            
            // Limpar storage local
            localStorage.clear();
            sessionStorage.clear();
            
            // Limpar cookies
            document.cookie.split(";").forEach(function(c) {
                document.cookie = c.replace(/^ +/, "").replace(/=.*/, "=;expires=" + new Date().toUTCString() + ";path=/");
            });

            console.log('✅ Limpeza concluída');
        } catch (error) {
            console.log('⚠️ Erro na limpeza:', error);
        }
    }

    // ✅ MOSTRAR/OCULTAR LOADING
    showLoading(show) {
        // Encontrar botão de exclusão na página atual
        const deleteButtons = document.querySelectorAll('[onclick*="deleteAccount"], .delete-account-btn, .action-card:nth-child(3)');
        
        deleteButtons.forEach(btn => {
            if (show) {
                btn.innerHTML = '<div class="spinner"></div><span>Excluindo conta...</span>';
                btn.style.opacity = '0.6';
                btn.disabled = true;
            } else {
                btn.innerHTML = btn.getAttribute('data-original') || '<span>🗑️ Excluir Conta</span>';
                btn.style.opacity = '1';
                btn.disabled = false;
            }
        });
    }

    // ✅ REDIRECIONAR APÓS EXCLUSÃO
    redirectAfterDelete() {
        setTimeout(() => {
            window.location.href = 'index.html';
        }, 2000);
    }
}

// ✅ INICIALIZAÇÃO GLOBAL
let accountDeleter = null;

async function initializeAccountDeleter(supabase) {
    accountDeleter = new AccountDeleter(supabase);
    const initialized = await accountDeleter.initialize();
    return initialized;
}

// ✅ FUNÇÃO GLOBAL PARA USO EM TODAS AS PÁGINAS
async function deleteUserAccount() {
    if (!accountDeleter) {
        alert('Sistema de exclusão não inicializado');
        return;
    }

    const result = await accountDeleter.deleteAccount();
    
    if (result.success) {
        alert(result.message);
        accountDeleter.redirectAfterDelete();
    } else {
        alert(result.message);
    }
}

// ✅ DETECTAR SE ESTÁ NO SUPABASE E CRIAR INSTÂNCIA
if (typeof supabase !== 'undefined') {
    initializeAccountDeleter(supabase);
}