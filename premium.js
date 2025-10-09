// premium.js - Controle de funcionalidades premium
const PremiumManager = {
    // VERIFICAR SE USUÁRIO É PREMIUM
    async checkPremiumStatus() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;
            
            const { data, error } = await supabase
                .rpc('is_user_premium', { user_uuid: user.id });
            
            if (error) {
                console.error('Erro ao verificar premium:', error);
                return false;
            }
            
            return data;
        } catch (error) {
            console.error('Erro:', error);
            return false;
        }
    },

    // VERIFICAR SE PODE ENVIAR MENSAGEM
    async canSendMessage() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return false;
            
            const { data, error } = await supabase
                .rpc('can_send_message', { user_uuid: user.id });
            
            if (error) {
                console.error('Erro ao verificar mensagens:', error);
                return false;
            }
            
            return data;
        } catch (error) {
            console.error('Erro:', error);
            return false;
        }
    },

    // INCREMENTAR CONTADOR DE MENSAGENS
    async incrementMessageCount() {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;
            
            const { error } = await supabase
                .rpc('increment_message_count', { user_uuid: user.id });
            
            if (error) {
                console.error('Erro ao incrementar mensagem:', error);
            }
        } catch (error) {
            console.error('Erro:', error);
        }
    }
};