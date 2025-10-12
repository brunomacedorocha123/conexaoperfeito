// Configuração do Supabase
const SUPABASE_URL = 'https://gcukalndarlgydmgmmmt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdjdWthbG5kYXJsZ3lkbWdtbW10Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk2NzI1ODEsImV4cCI6MjA3NTI0ODU4MX0.S1Qt1UbmK-Jtq2dX7Aarf2rDLZhoLgEcSLkCrBfIhUU';


const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
let currentUser = null;
let selectedAvatarFile = null;


// Sistema Premium
const PremiumManager = {
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
  }
};


document.addEventListener('DOMContentLoaded', function() {
  console.log(' Inicializando painel...');
  checkAuth();
});


// VERIFICA SE USUÁRIO ESTÁ LOGADO
async function checkAuth() {
  console.log(' Verificando autenticação...');
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    console.log('❌ Usuário não autenticado, redirecionando...');
    window.location.href = 'login.html';
    return;
  }
  currentUser = user;
  console.log('✅ Usuário autenticado:', user.email);
  setupEventListeners();
  await loadUserData();
  await loadProfileData();
  await updatePremiumStatus();
  await updateProfileCompletion();
  await updatePlanStatus();
}


// CONFIGURA EVENTOS
function setupEventListeners() {
  console.log(' Configurando event listeners...');
  
  // Form submission
  const profileForm = document.getElementById('profileForm');
  if (profileForm) {
    profileForm.addEventListener('submit', saveProfile);
    console.log('✅ Formulário configurado');
  }


  // Avatar upload
  const avatarButton = document.getElementById('avatarButton');
  const avatarInput = document.getElementById('avatarInput');
  
  if (avatarButton && avatarInput) {
    avatarButton.addEventListener('click', function(e) {
      e.preventDefault();
      console.log(' Clicou no botão de avatar');
      avatarInput.click();
    });
    console.log('✅ Botão de avatar configurado');
  }


  if (avatarInput) {
    avatarInput.addEventListener('change', handleAvatarSelect);
    console.log('✅ Input de arquivo configurado');
  }


  // Máscaras para CPF, Telefone e CEP
  const cpfInput = document.getElementById('cpf');
  const phoneInput = document.getElementById('phone');
  const zipCodeInput = document.getElementById('zipCode');


  if (cpfInput) cpfInput.addEventListener('input', maskCPF);
  if (phoneInput) phoneInput.addEventListener('input', maskPhone);
  if (zipCodeInput) zipCodeInput.addEventListener('input', maskCEP);


  // Character count
  const description = document.getElementById('description');
  if (description) {
    description.addEventListener('input', updateCharCount);
  }


  // Menu mobile
  const hamburgerBtn = document.getElementById('hamburgerBtn');
  const closeMobileMenu = document.getElementById('closeMobileMenu');
  const mobileMenu = document.getElementById('mobileMenu');


  if (hamburgerBtn) {
    hamburgerBtn.addEventListener('click', function() {
      if (mobileMenu) mobileMenu.style.display = 'flex';
    });
  }


  if (closeMobileMenu) {
    closeMobileMenu.addEventListener('click', function() {
      if (mobileMenu) mobileMenu.style.display = 'none';
    });
  }


  // Logout buttons
  const logoutBtn = document.getElementById('logoutBtn');
  const mobileLogoutBtn = document.getElementById('mobileLogoutBtn');


  if (logoutBtn) logoutBtn.addEventListener('click', logout);
  if (mobileLogoutBtn) mobileLogoutBtn.addEventListener('click', logout);


  // Fechar menu ao clicar em links
  document.querySelectorAll('.mobile-nav a').forEach(link => {
    link.addEventListener('click', () => {
      if (mobileMenu) mobileMenu.style.display = 'none';
    });
  });


  // Fechar menu com ESC
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && mobileMenu) {
      mobileMenu.style.display = 'none';
    }
  });


  console.log(' Todos os event listeners configurados');
}


// MÁSCARAS DE FORMULÁRIO
function maskCPF(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length <= 11) {
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d)/, '$1.$2');
    value = value.replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  }
  e.target.value = value;
}


function maskPhone(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length <= 11) {
    value = value.replace(/(\d{2})(\d)/, '($1) $2');
    value = value.replace(/(\d{5})(\d)/, '$1-$2');
  }
  e.target.value = value;
}


function maskCEP(e) {
  let value = e.target.value.replace(/\D/g, '');
  if (value.length <= 8) {
    value = value.replace(/(\d{5})(\d)/, '$1-$2');
  }
  e.target.value = value;
}


// ATUALIZAR STATUS DO PLANO
async function updatePlanStatus() {
  try {
    const isPremium = await PremiumManager.checkPremiumStatus();
    const planCard = document.getElementById('planStatusCard');
    const planBadge = document.getElementById('planBadge');
    const planDescription = document.getElementById('planDescription');
    const planActions = document.getElementById('planActions');


    if (isPremium) {
      planCard.classList.add('premium');
      planBadge.textContent = 'PREMIUM';
      planBadge.className = 'plan-badge premium';
      planDescription.textContent = 'Plano Premium com todos os benefícios ativos!';
      planActions.innerHTML = `
        <button class="btn btn-primary" onclick="window.location.href='mensagens.html'">
           Ir para Mensagens
        </button>
      `;
      
      const planFeatures = document.querySelector('.plan-features');
      if (planFeatures) {
        planFeatures.innerHTML = `
          <div class="feature-item">
            <span class="feature-icon"></span>
            <span class="feature-text">Mensagens ilimitadas</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon"></span>
            <span class="feature-text">Histórico permanente</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon">️</span>
            <span class="feature-text">Modo invisível</span>
          </div>
          <div class="feature-item">
            <span class="feature-icon"></span>
            <span class="feature-text">Ver visitantes</span>
          </div>
        `;
      }
    } else {
      planCard.classList.remove('premium');
      planBadge.textContent = 'GRATUITO';
      planBadge.className = 'plan-badge gratuito';
      planDescription.textContent = 'Plano gratuito com funcionalidades básicas';
      planActions.innerHTML = `
        <a href="planos.html" class="btn btn-primary">⭐ Fazer Upgrade</a>
      `;
    }


    console.log(`✅ Status do plano atualizado: ${isPremium ? 'PREMIUM' : 'GRATUITO'}`);
  } catch (error) {
    console.error('❌ Erro ao atualizar status do plano:', error);
  }
}


// ATUALIZAR STATUS PREMIUM
async function updatePremiumStatus() {
  try {
    const isPremium = await PremiumManager.checkPremiumStatus();
    
    if (isPremium) {
      const userInfo = document.querySelector('.user-info');
      if (userInfo && !userInfo.querySelector('.premium-badge')) {
        const badge = document.createElement('span');
        badge.className = 'premium-badge';
        badge.textContent = '⭐ PREMIUM';
        badge.style.background = 'var(--vermelho-rosado)';
        badge.style.color = 'white';
        badge.style.padding = '2px 8px';
        badge.style.borderRadius = '10px';
        badge.style.fontSize = '0.7rem';
        badge.style.marginLeft = '8px';
        badge.style.fontWeight = 'bold';
        userInfo.appendChild(badge);
      }


      const mobileUserInfo = document.querySelector('.mobile-user-info');
      if (mobileUserInfo && !mobileUserInfo.querySelector('.premium-badge')) {
        const mobileBadge = document.createElement('span');
        mobileBadge.className = 'premium-badge';
        mobileBadge.textContent = '⭐ PREMIUM';
        mobileBadge.style.background = 'var(--vermelho-rosado)';
        mobileBadge.style.color = 'white';
        mobileBadge.style.padding = '4px 12px';
        mobileBadge.style.borderRadius = '10px';
        mobileBadge.style.fontSize = '0.8rem';
        mobileBadge.style.marginTop = '8px';
        mobileBadge.style.fontWeight = 'bold';
        mobileBadge.style.display = 'block';
        mobileUserInfo.appendChild(mobileBadge);
      }


      console.log('✅ Usuário é Premium - badges adicionados');
    } else {
      console.log('ℹ️ Usuário é Gratuito');
    }
  } catch (error) {
    console.error('❌ Erro ao verificar status premium:', error);
  }
}


// ATUALIZAR PROGRESSO DO PERFIL
async function updateProfileCompletion() {
  try {
    const { data: completion, error } = await supabase
      .rpc('calculate_profile_completion', { user_uuid: currentUser.id });
    
    if (error) {
      console.error('❌ Erro ao calcular completude:', error);
      return;
    }


    const percentage = completion || 0;
    const progressFill = document.getElementById('progressFill');
    const completionPercentage = document.getElementById('completionPercentage');
    const progressText = document.getElementById('progressText');


    if (progressFill) progressFill.style.width = `${percentage}%`;
    if (completionPercentage) completionPercentage.textContent = `${percentage}%`;
    
    if (progressText) {
      if (percentage < 30) {
        progressText.textContent = 'Complete seu perfil para melhorar suas conexões';
      } else if (percentage < 70) {
        progressText.textContent = 'Seu perfil está ficando interessante! Continue...';
      } else if (percentage < 100) {
        progressText.textContent = 'Quase lá! Complete os últimos detalhes';
      } else {
        progressText.textContent = ' Perfil 100% completo!';
      }
    }


    console.log(` Progresso do perfil: ${percentage}%`);
  } catch (error) {
    console.error('❌ Erro ao atualizar progresso:', error);
  }
}


// CARREGA DADOS BÁSICOS DO USUÁRIO
async function loadUserData() {
  try {
    console.log(' Carregando dados do usuário...');
    
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('nickname, avatar_url')
      .eq('id', currentUser.id)
      .single();
    
    if (error && error.code === 'PGRST116') {
      console.log(' Criando perfil novo...');
      await createUserProfile();
      return;
    }
    
    if (profile) {
      const displayName = profile.nickname || currentUser.email.split('@')[0];
      
      document.getElementById('userNickname').textContent = displayName;
      document.getElementById('mobileUserNickname').textContent = displayName;
      
      console.log('✅ Nickname no header:', displayName);
      
      if (profile.avatar_url) {
        console.log('️ Carregando avatar existente...');
        await loadAvatar(profile.avatar_url);
      } else {
        console.log('❌ Nenhum avatar encontrado');
        showFallbackAvatars();
      }
    } else {
      const fallbackName = currentUser.email.split('@')[0];
      document.getElementById('userNickname').textContent = fallbackName;
      document.getElementById('mobileUserNickname').textContent = fallbackName;
    }
  } catch (error) {
    console.error('❌ Erro ao carregar dados do usuário:', error);
    
    const fallbackName = currentUser?.email?.split('@')[0] || 'Usuário';
    document.getElementById('userNickname').textContent = fallbackName;
    document.getElementById('mobileUserNickname').textContent = fallbackName;
    
    showNotification('❌ Erro ao carregar dados do perfil', 'error');
  }
}


// CRIA PERFIL DO USUÁRIO SE NÃO EXISTIR
async function createUserProfile() {
  try {
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: currentUser.id,
        nickname: currentUser.email.split('@')[0],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });


    if (profileError) throw profileError;


    const { error: detailsError } = await supabase
      .from('user_details')
      .insert({
        user_id: currentUser.id,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });


    if (detailsError) throw detailsError;
    
    console.log('✅ Perfil criado com sucesso!');
    await loadUserData();
    
  } catch (error) {
    console.error('❌ Erro ao criar perfil:', error);
    showNotification('❌ Erro ao criar perfil.', 'error');
  }
}


// CARREGA AVATAR
async function loadAvatar(avatarPath) {
  try {
    console.log(' Carregando avatar:', avatarPath);
    
    const { data } = supabase.storage
      .from('avatars')
      .getPublicUrl(avatarPath);


    if (data && data.publicUrl) {
      console.log('✅ URL pública do avatar:', data.publicUrl);
      updateAvatarImages(data.publicUrl);
    } else {
      console.log('❌ Não foi possível obter URL pública');
      showFallbackAvatars();
    }
  } catch (error) {
    console.log('❌ Erro ao carregar avatar:', error);
    showFallbackAvatars();
  }
}


// ATUALIZA IMAGENS DE AVATAR
function updateAvatarImages(imageUrl) {
  const avatarImgs = document.querySelectorAll('.user-avatar-img');
  const previewImg = document.getElementById('avatarPreviewImg');
  const fallbacks = document.querySelectorAll('.user-avatar-fallback, .avatar-fallback');
  
  console.log('✅ Atualizando avatares com URL:', imageUrl);
  
  avatarImgs.forEach(img => {
    img.src = imageUrl;
    img.style.display = 'block';
    img.onerror = () => {
      console.log('❌ Erro ao carregar imagem do avatar');
      img.style.display = 'none';
    };
  });
  
  if (previewImg) {
    previewImg.src = imageUrl;
    previewImg.style.display = 'block';
    previewImg.onerror = () => {
      console.log('❌ Erro ao carregar preview do avatar');
      previewImg.style.display = 'none';
      document.getElementById('avatarFallback').style.display = 'flex';
    };
  }
  
  fallbacks.forEach(fb => {
    fb.style.display = 'none';
  });
}


// MOSTRA FALLBACK
function showFallbackAvatars() {
  document.querySelectorAll('.user-avatar-fallback, .avatar-fallback').forEach(fb => {
    fb.style.display = 'flex';
  });
}


// CARREGA DADOS DO PERFIL
async function loadProfileData() {
  try {
    console.log(' Carregando dados do perfil...');
    
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();


    if (profileError && profileError.code === 'PGRST116') {
      await createUserProfile();
      return;
    }


    const { data: userDetails, error: detailsError } = await supabase
      .from('user_details')
      .select('*')
      .eq('user_id', currentUser.id)
      .single();


    if (detailsError && detailsError.code === 'PGRST116') {
      await supabase
        .from('user_details')
        .insert({
          user_id: currentUser.id,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
      return;
    }


    const emailInput = document.getElementById('email');
    if (emailInput) {
      emailInput.value = currentUser.email || '';
      console.log('✅ E-mail preenchido:', currentUser.email);
    }


    if (profile) {
      document.getElementById('fullName').value = profile.full_name || '';
      document.getElementById('cpf').value = profile.cpf || '';
      document.getElementById('birthDate').value = profile.birth_date || '';
      document.getElementById('phone').value = profile.phone || '';
      document.getElementById('street').value = profile.street || '';
      document.getElementById('number').value = profile.number || '';
      document.getElementById('neighborhood').value = profile.neighborhood || '';
      document.getElementById('city').value = profile.city || '';
      document.getElementById('state').value = profile.state || '';
      document.getElementById('zipCode').value = profile.zip_code || '';
      document.getElementById('nickname').value = profile.nickname || '';
      
      if (profile.city && profile.state && (!userDetails || !userDetails.display_city)) {
        document.getElementById('displayCity').value = `${profile.city}, ${profile.state}`;
      }
    }


    if (userDetails) {
      if (userDetails.display_city) {
        document.getElementById('displayCity').value = userDetails.display_city;
      }
      document.getElementById('gender').value = userDetails.gender || '';
      document.getElementById('sexualOrientation').value = userDetails.sexual_orientation || '';
      document.getElementById('profession').value = userDetails.profession || '';
      document.getElementById('education').value = userDetails.education || '';
      document.getElementById('zodiac').value = userDetails.zodiac || '';
      document.getElementById('lookingFor').value = userDetails.looking_for || '';
      document.getElementById('description').value = userDetails.description || '';
      document.getElementById('religion').value = userDetails.religion || '';
      document.getElementById('drinking').value = userDetails.drinking || '';
      document.getElementById('smoking').value = userDetails.smoking || '';
      document.getElementById('exercise').value = userDetails.exercise || '';
      document.getElementById('exerciseDetails').value = userDetails.exercise_details || '';
      document.getElementById('hasPets').value = userDetails.has_pets || '';
      document.getElementById('petsDetails').value = userDetails.pets_details || '';
      
      if (userDetails.interests) {
        document.querySelectorAll('input[name="interests"]').forEach(checkbox => {
          checkbox.checked = userDetails.interests.includes(checkbox.value);
        });
      }
    }


    updateCharCount();
    console.log('✅ Dados do perfil carregados');


  } catch (error) {
    console.error('❌ Erro ao carregar perfil:', error);
    showNotification('❌ Erro ao carregar dados do perfil', 'error');
  }
}


// HANDLE AVATAR SELECT
function handleAvatarSelect(event) {
  console.log(' Arquivo selecionado:', event.target.files[0]);
  const file = event.target.files[0];
  if (!file) {
    console.log('❌ Nenhum arquivo selecionado');
    return;
  }


  if (file.size > 256000) {
    showNotification('❌ A imagem deve ter no máximo 250KB!', 'error');
    return;
  }


  if (!file.type.startsWith('image/')) {
    showNotification('❌ Selecione uma imagem válida (JPG, PNG, GIF)!', 'error');
    return;
  }


  selectedAvatarFile = file;
  console.log('✅ Arquivo validado:', file.name, file.size, 'bytes');


  const reader = new FileReader();
  reader.onload = function(e) {
    console.log('️ Criando preview da imagem...');
    
    const previewImg = document.getElementById('avatarPreviewImg');
    const fallback = document.getElementById('avatarFallback');
    const avatarImgs = document.querySelectorAll('.user-avatar-img');
    const headerFallbacks = document.querySelectorAll('.user-avatar-fallback');
    
    previewImg.src = e.target.result;
    previewImg.style.display = 'block';
    fallback.style.display = 'none';
    
    avatarImgs.forEach(img => {
      img.src = e.target.result;
      img.style.display = 'block';
    });
    
    headerFallbacks.forEach(fb => {
      fb.style.display = 'none';
    });
    
    showNotification('✅ Imagem selecionada! Clique em Salvar Perfil para confirmar.', 'success');
  };
  reader.onerror = function() {
    console.error('❌ Erro ao ler arquivo');
    showNotification('❌ Erro ao carregar imagem', 'error');
  };
  reader.readAsDataURL(file);
}


// UPLOAD DE AVATAR - CORRIGIDO
async function uploadAvatar(file) {
  try {
    console.log(' Iniciando upload do avatar...');
    
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}_avatar.${fileExt}`;
    const filePath = `${currentUser.id}/${fileName}`;


    console.log(' Fazendo upload para:', filePath);


    // Tenta criar a pasta primeiro listando o conteúdo
    try {
      await supabase.storage
        .from('avatars')
        .list(currentUser.id);
    } catch (e) {
      console.log(' Pasta não existe, será criada automaticamente');
    }


    // Upload com timeout
    const uploadPromise = supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: true
      });


    // Timeout de 10 segundos
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout no upload')), 10000);
    });


    const { data, error } = await Promise.race([uploadPromise, timeoutPromise]);


    if (error) {
      console.error('❌ Erro no upload:', error);
      
      // Tentativa alternativa sem options
      const { data: retryData, error: retryError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file);
        
      if (retryError) {
        console.error('❌ Erro na segunda tentativa:', retryError);
        throw new Error(`Falha no upload: ${retryError.message}`);
      }
      
      console.log('✅ Upload realizado na segunda tentativa:', retryData);
      return filePath;
    }


    console.log('✅ Upload realizado com sucesso:', data);
    return filePath;


  } catch (error) {
    console.error('❌ Erro completo no upload:', error);
    
    // Fallback: Continuar sem avatar
    showNotification('⚠️ Imagem não pôde ser enviada, mas o perfil será salvo.', 'warning');
    return null;
  }
}


// SALVA PERFIL - CORRIGIDO
async function saveProfile(event) {
  event.preventDefault();
  console.log(' Salvando perfil...');
  
  const saveButton = document.getElementById('saveButton');
  const originalText = saveButton.innerHTML;
  
  try {
    saveButton.innerHTML = '⏳ Salvando...';
    saveButton.disabled = true;


    let avatarPath = null;


    // Upload da imagem se foi selecionada (não bloqueia se falhar)
    if (selectedAvatarFile) {
      console.log(' Fazendo upload da imagem...');
      showNotification(' Enviando imagem...', 'info');
      try {
        avatarPath = await uploadAvatar(selectedAvatarFile);
        if (avatarPath) {
          showNotification('✅ Imagem enviada com sucesso!', 'success');
        }
      } catch (uploadError) {
        console.error('❌ Upload falhou, continuando sem imagem:', uploadError);
        showNotification('⚠️ Imagem não enviada, mas perfil será salvo', 'warning');
      }
    }


    // DADOS DO PERFIL
    const profileData = {
      full_name: document.getElementById('fullName').value.trim(),
      cpf: document.getElementById('cpf').value.replace(/\D/g, ''),
      birth_date: document.getElementById('birthDate').value,
      phone: document.getElementById('phone').value.replace(/\D/g, ''),
      street: document.getElementById('street').value.trim(),
      number: document.getElementById('number').value.trim(),
      neighborhood: document.getElementById('neighborhood').value.trim(),
      city: document.getElementById('city').value.trim(),
      state: document.getElementById('state').value,
      zip_code: document.getElementById('zipCode').value.replace(/\D/g, ''),
      nickname: document.getElementById('nickname').value.trim(),
      updated_at: new Date().toISOString()
    };


    // Adiciona avatar path se foi feito upload
    if (avatarPath) {
      profileData.avatar_url = avatarPath;
    }


    // DADOS DETALHADOS
    const userDetailsData = {
      display_city: document.getElementById('displayCity').value.trim(),
      gender: document.getElementById('gender').value,
      sexual_orientation: document.getElementById('sexualOrientation').value,
      profession: document.getElementById('profession').value.trim(),
      education: document.getElementById('education').value,
      zodiac: document.getElementById('zodiac').value,
      looking_for: document.getElementById('lookingFor').value,
      description: document.getElementById('description').value.trim(),
      religion: document.getElementById('religion').value,
      drinking: document.getElementById('drinking').value,
      smoking: document.getElementById('smoking').value,
      exercise: document.getElementById('exercise').value,
      exercise_details: document.getElementById('exerciseDetails').value.trim(),
      has_pets: document.getElementById('hasPets').value,
      pets_details: document.getElementById('petsDetails').value.trim(),
      updated_at: new Date().toISOString()
    };


    // Interesses
    const selectedInterests = [];
    document.querySelectorAll('input[name="interests"]:checked').forEach(checkbox => {
      selectedInterests.push(checkbox.value);
    });
    userDetailsData.interests = selectedInterests;


    // VALIDAÇÕES OBRIGATÓRIAS
    if (!profileData.nickname) {
      showNotification('❌ Informe um nickname!', 'error');
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
      return;
    }
    if (!profileData.birth_date) {
      showNotification('❌ Informe a data de nascimento!', 'error');
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
      return;
    }
    
    // Calcula idade
    const birthDate = new Date(profileData.birth_date);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    
    if (age < 18) {
      showNotification('❌ Você deve ter pelo menos 18 anos!', 'error');
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
      return;
    }
    
    if (!userDetailsData.gender) {
      showNotification('❌ Informe o gênero!', 'error');
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
      return;
    }
    if (!userDetailsData.looking_for) {
      showNotification('❌ Informe o que você procura!', 'error');
      saveButton.innerHTML = originalText;
      saveButton.disabled = false;
      return;
    }


    // Salva no banco
    console.log(' Salvando no banco de dados...');
    showNotification(' Salvando dados do perfil...', 'info');


    // Atualiza perfil principal
    const { error: profileError } = await supabase
      .from('profiles')
      .upsert({
        id: currentUser.id,
        ...profileData
      }, { onConflict: 'id' });


    if (profileError) {
      console.error('❌ Erro ao salvar perfil:', profileError);
      throw profileError;
    }


    // Atualiza detalhes do usuário
    const { error: detailsError } = await supabase
      .from('user_details')
      .upsert({
        user_id: currentUser.id,
        ...userDetailsData
      }, { onConflict: 'user_id' });


    if (detailsError) {
      console.error('❌ Erro ao salvar detalhes:', detailsError);
      throw detailsError;
    }


    // Atualiza interface
    document.getElementById('userNickname').textContent = profileData.nickname;
    document.getElementById('mobileUserNickname').textContent = profileData.nickname;
    
    // Reseta o arquivo selecionado
    selectedAvatarFile = null;
    document.getElementById('avatarInput').value = '';
    
    console.log('✅ Perfil salvo com sucesso!');
    showNotification('✅ Perfil salvo com sucesso!', 'success');
    
    // ATUALIZA PROGRESSO APÓS SALVAR
    await updateProfileCompletion();
    await updatePremiumStatus();
    await updatePlanStatus();
    
    // Recarrega o avatar se foi atualizado
    if (avatarPath) {
      setTimeout(() => {
        loadAvatar(avatarPath);
      }, 1000);
    }


  } catch (error) {
    console.error('❌ Erro ao salvar perfil:', error);
    showNotification('❌ Erro ao salvar perfil: ' + error.message, 'error');
  } finally {
    saveButton.innerHTML = originalText;
    saveButton.disabled = false;
  }
}


// NOTIFICAÇÕES
function showNotification(message, type = 'info') {
  const existingNotification = document.querySelector('.notification');
  if (existingNotification) {
    existingNotification.remove();
  }


  const notification = document.createElement('div');
  notification.className = `notification notification-${type}`;
  notification.innerHTML = `
    <div class="notification-content">
      <span class="notification-message">${message}</span>
      <button class="notification-close">×</button>
    </div>
  `;


  notification.style.cssText = `
    position: fixed;
    top: 100px;
    right: 20px;
    background: ${type === 'error' ? '#f56565' : type === 'success' ? '#48bb78' : type === 'warning' ? '#ed8936' : '#4299e1'};
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 10000;
    max-width: 300px;
    animation: slideIn 0.3s ease;
  `;


  notification.querySelector('.notification-close').onclick = () => notification.remove();
  document.body.appendChild(notification);


  setTimeout(() => notification.remove(), 5000);
}


// CONTADOR DE CARACTERES
function updateCharCount() {
  const textarea = document.getElementById('description');
  const charCount = document.getElementById('charCount');
  if (textarea && charCount) {
    const count = textarea.value.length;
    charCount.textContent = count;
    charCount.style.color = count > 90 ? '#f56565' : count > 80 ? '#ed8936' : 'var(--text-light)';
  }
}


// LOGOUT
async function logout() {
  try {
    await supabase.auth.signOut();
    window.location.href = 'login.html';
  } catch (error) {
    console.error('Erro ao fazer logout:', error);
  }
}


// Adiciona estilos CSS para animações
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { transform: translateX(100%); opacity: 0; }
    to { transform: translateX(0); opacity: 1; }
  }
  
  .notification {
    font-family: Arial, sans-serif;
  }
  
  .notification-content {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }
  
  .notification-close {
    background: none;
    border: none;
    color: white;
    font-size: 18px;
    cursor: pointer;
    margin-left: 10px;
  }
`;
document.head.appendChild(style);
