// -- CONFIG SUPABASE --
const SUPABASE_URL = 'https://bdxynpiwuwceakzriguz.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJkeHlucGl3dXdjZWFrenJpZ3V6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzI5NTg5NzAsImV4cCI6MjA4ODUzNDk3MH0.s4OLrK1VEAVSX_VTk7o1oEeGmeBnofr_U7UfD0-dO68';
const sb = supabase.createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    storageKey: 'ledevisco-auth',
    storage: window.localStorage
  }
});

// -- NAVIGATION --
function showSection(id) {
  var sections = document.querySelectorAll('section');
  for (var i=0; i<sections.length; i++) sections[i].classList.remove('active');
  document.getElementById(id).classList.add('active');
  window.scrollTo(0,0);
  if (id === 'annonces') loadAnnonces();
  if (id === 'dashboard') loadDashboard();
}

// -- TOAST --
function toast(msg, type) {
  type = type || 'success';
  var t = document.getElementById('toast');
  document.getElementById('toast-msg').textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(function() { t.classList.remove('show'); }, 3500);
}

// -- MODALS --
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function openNegocModal() { openModal('modal-negoc'); }
function openContreDevisModal() { openModal('modal-offres'); }
function openUnlockModal() { closeModal('modal-offres'); openModal('modal-unlock'); }

// -- TABS --
function switchTab(tab, btn) {
  var tabs = ['mes-annonces','contre-devis','commissions'];
  for (var i=0; i<tabs.length; i++) document.getElementById('tab-'+tabs[i]).style.display = 'none';
  document.getElementById('tab-'+tab).style.display = 'block';
  var btns = document.querySelectorAll('.dash-tab');
  for (var i=0; i<btns.length; i++) btns[i].classList.remove('active');
  btn.classList.add('active');
}
function switchAuth(tab, btn) {
  document.getElementById('auth-login').style.display = tab==='login' ? 'block' : 'none';
  document.getElementById('auth-register').style.display = tab==='register' ? 'block' : 'none';
  var btns = document.querySelectorAll('.auth-tab');
  for (var i=0; i<btns.length; i++) btns[i].classList.remove('active');
  btn.classList.add('active');
}

// -- COMMISSION --
var COMM = [{min:10,max:19.99,pct:0.40},{min:20,max:29.99,pct:0.35},{min:30,max:39.99,pct:0.30},{min:40,max:49.99,pct:0.25},{min:50,max:59.99,pct:0.22},{min:60,max:69.99,pct:0.20},{min:70,max:79.99,pct:0.20}];
function getComm(eco) {
  for (var i=0; i<COMM.length; i++) if (eco>=COMM[i].min && eco<=COMM[i].max) return COMM[i];
  if (eco>79.99) return {pct:0.20};
  return null;
}
function calcCommission() {
  var init=parseFloat(document.getElementById('calc-initial').value);
  var contre=parseFloat(document.getElementById('calc-contre').value);
  if (isNaN(init)||isNaN(contre)||contre>=init) { toast('Entrez des montants valides','error'); return; }
  var eco=init-contre, row=getComm(eco);
  if (!row) { toast('Economie minimum 10 euros','error'); return; }
  var total=eco*row.pct, plat=total*0.20, net=total-plat;
  document.getElementById('calc-result').classList.add('show');
  document.getElementById('cr-eco').textContent=eco.toFixed(2)+'EUR';
  document.getElementById('cr-pct').textContent=(row.pct*100)+'%';
  document.getElementById('cr-total').textContent=total.toFixed(2)+'EUR';
  document.getElementById('cr-plat').textContent=plat.toFixed(2)+'EUR';
  document.getElementById('cr-net').textContent=net.toFixed(2)+'EUR';
}
function previewComm() {
  var v=parseFloat(document.getElementById('n-montant').value);
  var init = currentDevisAmount || 4200;
  if (isNaN(v)||v>=init) return;
  var eco=init-v, row=getComm(eco);
  if (!row) return;
  var net=(eco*row.pct)*0.80;
  document.getElementById('comm-preview').style.display='block';
  document.getElementById('prev-eco').textContent=eco.toFixed(2)+'EUR';
  document.getElementById('prev-net').textContent=net.toFixed(2)+'EUR';
}

// -- POSTER UN DEVIS (SUPABASE) --
async function uploadFile(file, bucket) {
  if (!file) return null;
  var ext = file.name.split('.').pop();
  var filename = Date.now() + '_' + Math.random().toString(36).substr(2,9) + '.' + ext;
  var result = await sb.storage.from(bucket).upload(filename, file, {cacheControl:'3600', upsert:false});
  if (result.error) { console.error('Upload error:', result.error); return null; }
  var urlResult = sb.storage.from(bucket).getPublicUrl(filename);
  return urlResult.data.publicUrl;
}

async function posterDevis() {
  var titre = document.getElementById('f-titre').value;
  var montant = document.getElementById('f-montant').value;
  var email = document.getElementById('f-email').value;
  var cat = document.getElementById('f-cat').value;
  var region = document.getElementById('f-region').value;
  var departement = document.getElementById('f-dep').value || '';
  var desc = document.getElementById('f-desc').value;
  var detail = document.getElementById('f-detail').value;
  var numdevis = document.getElementById('f-numdevis').value;
  var datedevis = document.getElementById('f-datedevis').value;
  var entreprise = document.getElementById('f-entreprise').value;
  var fileInput = document.getElementById('file-devis');
  var file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;

  if (!titre||!montant||!email||!cat||!region) {
    toast('Remplissez tous les champs obligatoires','error');
    return;
  }

  var btn = document.querySelector('#poster .submit-btn');
  btn.textContent = 'Upload en cours...';
  btn.disabled = true;

  // Upload file if present
  var fichierUrl = null;
  if (file) {
    btn.textContent = 'Upload du fichier...';
    fichierUrl = await uploadFile(file, 'devis-files');
    if (!fichierUrl) {
      toast('Erreur upload fichier - verifiez le bucket Supabase','error');
      btn.textContent = 'Publier mon annonce';
      btn.disabled = false;
      return;
    }
  }

  btn.textContent = 'Publication en cours...';

  var data = {
    titre: titre,
    montant: parseFloat(montant),
    email_auteur: email,
    categorie: cat,
    region: region,
    departement: departement,
    description: desc,
    detail: detail,
    numero_devis: numdevis,
    date_devis: datedevis || null,
    nom_entreprise: entreprise,
    fichier_url: fichierUrl,
    statut: 'ouvert'
  };

  var result = await sb.from('devis').insert([data]);

  btn.textContent = 'Publier mon annonce';
  btn.disabled = false;

  if (result.error) {
    toast('Erreur : ' + result.error.message, 'error');
  } else {
    toast('Annonce publiee avec succes !');
    document.getElementById('f-titre').value='';
    document.getElementById('f-montant').value='';
    document.getElementById('f-email').value='';
    document.getElementById('f-desc').value='';
    document.getElementById('f-detail').value='';
    if (fileInput) fileInput.value='';
    document.getElementById('preview-devis').innerHTML='';
    setTimeout(function(){ showSection('annonces'); }, 1500);
  }
}

// -- CHARGER LES ANNONCES (SUPABASE) --
var currentDevisId = null;
var currentDevisAmount = 4200;

async function loadAnnonces() {
  var grid = document.getElementById('annonces-grid');
  grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray);">Chargement...</div>';

  var cat = document.getElementById('filter-cat') ? document.getElementById('filter-cat').value : '';
  var region = document.getElementById('filter-region') ? document.getElementById('filter-region').value : '';
  var dep = document.getElementById('filter-dep') ? document.getElementById('filter-dep').value : '';

  var query = sb.from('devis').select('*').eq('statut','ouvert');
  if (cat) query = query.eq('categorie', cat);
  if (dep) query = query.eq('region', dep);
  else if (region) query = query.eq('region', region);
  query = query.order('created_at', {ascending: false});

  var result = await query;

  if (result.error) {
    grid.innerHTML = '<div style="text-align:center;padding:60px;color:red;">Erreur de chargement</div>';
    return;
  }

  var annonces = result.data;

  // Annonces fictives terminees pour montrer l activite du site
  var fictives = [
    { id:'f1', titre:'Remplacement 4 pneus Renault Megane', categorie:'Auto/Mecanique', region:'Ile-de-France', montant:520, economie:131, statut:'termine', description:'4 pneus ete 205/55 R16 + montage equilibrage', created_at: new Date(Date.now()-2*86400000).toISOString() },
    { id:'f2', titre:'Ramonage conduit de cheminee', categorie:'Travaux/Renovation', region:'Auvergne-Rhone-Alpes', montant:180, economie:60, statut:'termine', description:'Ramonage cheminee bois + certificat', created_at: new Date(Date.now()-4*86400000).toISOString() },
    { id:'f3', titre:'Revision + vidange Peugeot 308', categorie:'Auto/Mecanique', region:'Bretagne', montant:320, economie:91, statut:'termine', description:'Revision 60 000km + vidange huile 5W30', created_at: new Date(Date.now()-5*86400000).toISOString() },
    { id:'f4', titre:'Refection toiture garage 20m2', categorie:'Travaux/Renovation', region:'Normandie', montant:2800, economie:700, statut:'termine', description:'Tuiles canal + etancheite + faitage', created_at: new Date(Date.now()-7*86400000).toISOString() },
    { id:'f5', titre:'Taille haie + entretien jardin 400m2', categorie:'Jardinage/Paysage', region:'Pays de la Loire', montant:280, economie:85, statut:'termine', description:'Taille haie thuyas 40ml + debroussaillage', created_at: new Date(Date.now()-9*86400000).toISOString() },
    { id:'f6', titre:'Reparation ecran MacBook Pro 13', categorie:'Informatique/Tech', region:'Ile-de-France', montant:450, economie:160, statut:'termine', description:'Remplacement dalle LCD retina fissure', created_at: new Date(Date.now()-11*86400000).toISOString() },
    { id:'f7', titre:'Changement plaquettes frein + disques', categorie:'Auto/Mecanique', region:'Hauts-de-France', montant:390, economie:115, statut:'termine', description:'Disques + plaquettes av/ar Citroen C3', created_at: new Date(Date.now()-13*86400000).toISOString() },
    { id:'f8', titre:'Installation climatisation reversible', categorie:'Travaux/Renovation', region:'Provence-Alpes-Cote d Azur', montant:1800, economie:450, statut:'termine', description:'Clim reversible 3500W + pose + mise en service', created_at: new Date(Date.now()-15*86400000).toISOString() },
    { id:'f9', titre:'Conduit de cheminee + insert bois', categorie:'Travaux/Renovation', region:'Nouvelle-Aquitaine', montant:3200, economie:720, statut:'termine', description:'Insert bois 10kW + tubage inox 8m', created_at: new Date(Date.now()-18*86400000).toISOString() },
    { id:'f10', titre:'Nettoyage apres travaux 90m2', categorie:'Menage/Entretien', region:'Grand Est', montant:420, economie:130, statut:'termine', description:'Nettoyage complet fin chantier appartement 90m2', created_at: new Date(Date.now()-20*86400000).toISOString() },
  ];

  // Filtrage fictives selon filtres actifs
  var filteredFictives = fictives.filter(function(f) {
    if (cat && f.categorie !== cat) return false;
    if (region && f.region !== region) return false;
    return true;
  });

  annonces = annonces.concat(filteredFictives);

  if (annonces.length === 0) {
    grid.innerHTML = '<div style="text-align:center;padding:60px;color:var(--gray);">Aucune annonce pour le moment. Soyez le premier a poster !</div>';
    return;
  }

  var html = '';
  for (var i=0; i<annonces.length; i++) {
    var a = annonces[i];
    var date = new Date(a.created_at);
    var age = Math.floor((Date.now() - date) / 3600000);
    var ageStr = age < 24 ? 'Il y a ' + age + 'h' : 'Il y a ' + Math.floor(age/24) + ' jours';
    html += '<div class="annonce-card" onclick="openAnnonceDetail(\"'+a.id+'\",'+a.montant+')">';
    html += '<div class="card-top"><span class="cat-badge">'+a.categorie+'</span><span class="region-tag">'+(a.departement ? a.departement : a.region)+'</span></div>';
    html += '<h3>'+a.titre+'</h3>';
    html += '<p class="desc">'+(a.description||'')+'</p>';
    html += '<div class="card-footer">';
    if (a.statut === 'termine') {
      html += '<div><div class="devis-label">Devis initial</div><div class="devis-amount">'+a.montant.toLocaleString('fr-FR')+'EUR</div></div>';
      html += '<div style="text-align:right;"><span style="background:#e8faf5;color:#00C896;font-size:0.78rem;font-weight:700;padding:4px 10px;border-radius:20px;">Termine</span><div style="font-size:0.82rem;color:#00C896;font-weight:700;margin-top:4px;">-'+a.economie+'EUR economise</div></div>';
    } else {
      html += '<div><div class="devis-label">Devis initial</div><div class="devis-amount">'+a.montant.toLocaleString('fr-FR')+'EUR</div></div>';
      html += '<button class="card-cta" onclick="event.stopPropagation();openAnnonceDetail(\''+a.id+'\','+a.montant+')">Proposer</button>';
    }
    html += '</div>';
    html += '<div class="responses-count">'+ageStr+(a.fichier_url ? ' - <a href="'+a.fichier_url+'" target="_blank" style="color:var(--accent);">Voir le devis</a>' : '')+'</div>';
    html += '</div>';
  }
  grid.innerHTML = html;
}

async function openAnnonceDetail(id, montant) {
  currentDevisId = id;
  currentDevisAmount = montant;
  openModal('modal-negoc');
}

// -- SOUMETTRE CONTRE-DEVIS (SUPABASE) --
async function submitContreDevis() {
  var montant = document.getElementById('n-montant').value;
  var entreprise = document.getElementById('n-entreprise').value;
  var adresse = document.getElementById('n-adresse').value;
  var tel = document.getElementById('n-tel').value;
  var emailE = document.getElementById('n-email-entreprise').value;
  var siret = document.getElementById('n-siret').value;

  if (!montant||!entreprise||!emailE||!siret) {
    toast('Remplissez tous les champs obligatoires','error');
    return;
  }
  if (!currentDevisId) {
    toast('Erreur : aucun devis selectionne','error');
    return;
  }

  var eco = currentDevisAmount - parseFloat(montant);
  var row = getComm(eco);
  var commTotal = row ? eco * row.pct : 0;
  var commMembre = commTotal * 0.80;
  var commPlat = commTotal * 0.20;

  var btn = document.querySelector('#modal-negoc .submit-btn');
  btn.textContent = 'Upload en cours...';
  btn.disabled = true;

  // Upload contre-devis file
  var cdFileInput = document.getElementById('file-cd');
  var cdFile = cdFileInput && cdFileInput.files[0] ? cdFileInput.files[0] : null;
  var cdFichierUrl = null;
  if (cdFile) {
    cdFichierUrl = await uploadFile(cdFile, 'contre-devis-files');
  }

  btn.textContent = 'Envoi en cours...';

  var data = {
    devis_id: currentDevisId,
    fichier_url: cdFichierUrl,
    montant: parseFloat(montant),
    entreprise_nom: entreprise,
    entreprise_adresse: adresse,
    entreprise_tel: tel,
    entreprise_email: emailE,
    entreprise_siret: siret,
    statut_verification: 'en_attente',
    statut_paiement: 'non_paye',
    commission_total: commTotal,
    commission_membre: commMembre,
    commission_plateforme: commPlat
  };

  var result = await sb.from('contre_devis').insert([data]);

  btn.textContent = 'Soumettre mon contre-devis';
  btn.disabled = false;

  if (result.error) {
    toast('Erreur : ' + result.error.message, 'error');
  } else {
    closeModal('modal-negoc');
    toast('Contre-devis soumis avec succes ! L\'entreprise sera contactee pour verification.');
  }
}

// -- INSCRIPTION (SUPABASE AUTH) --
async function fakeRegister() {
  var prenom = document.querySelector('#auth-register input[placeholder="Jean"]').value;
  var nom = document.querySelector('#auth-register input[placeholder="Dupont"]').value;
  var email = document.querySelector('#auth-register input[type="email"]').value;
  var region = document.querySelector('#auth-register select').value;
  var mdp = document.querySelector('#auth-register input[type="password"]').value;

  if (!prenom||!nom||!email||!mdp) { toast('Remplissez tous les champs','error'); return; }

  var btn = document.querySelector('#auth-register .submit-btn');
  btn.textContent = 'Creation en cours...';
  btn.disabled = true;

  // Create auth user
  var authResult = await sb.auth.signUp({ email: email, password: mdp });

  if (authResult.error) {
    var msg = authResult.error.message;
    if (msg.includes('already registered') || msg.includes('already been registered')) {
      toast('Cette adresse email est deja utilisee. Connectez-vous !', 'error');
      setTimeout(function() {
        var loginBtn = document.querySelector('.auth-tab');
        if (loginBtn) switchAuth('login', loginBtn);
      }, 1500);
    } else {
      toast('Erreur : ' + msg, 'error');
    }
    btn.textContent = 'Creer mon compte membre';
    btn.disabled = false;
    return;
  }

  // Save member profile
  await sb.from('membres').insert([{
    email: email,
    prenom: prenom,
    nom: nom,
    region: region,
    statut: 'valide'
  }]);

  btn.textContent = 'Creer mon compte membre';
  btn.disabled = false;
  toast('Compte cree ! Verifiez votre boite email ET vos courriers indesirables.');
  // Show extra info message
  var info = document.getElementById('register-info-msg');
  if (info) info.style.display = 'block';
}

// -- CONNEXION (SUPABASE AUTH) --
async function fakeLogin() {
  var email = document.querySelector('#auth-login input[type="email"]').value;
  var mdp = document.querySelector('#auth-login input[type="password"]').value;

  if (!email||!mdp) { toast('Entrez votre email et mot de passe','error'); return; }

  var btn = document.querySelector('#auth-login .submit-btn');
  btn.textContent = 'Connexion...';
  btn.disabled = true;

  var result = await sb.auth.signInWithPassword({ email: email, password: mdp });

  btn.textContent = 'Se connecter';
  btn.disabled = false;

  if (result.error) {
    toast('Email ou mot de passe incorrect','error');
  } else {
    toast('Connexion reussie ! Bienvenue.');
    setTimeout(function(){ showSection('dashboard'); }, 1000);
  }
}

// -- DASHBOARD --
async function loadDashboard() {
  var session = await sb.auth.getSession();
  if (!session.data.session) {
    toast('Connectez-vous pour acceder au dashboard','error');
    showSection('auth');
    return;
  }
  var email = session.data.session.user.email;
  // Fetch prenom from membres table
  var result = await sb.from('membres').select('prenom').eq('email', email).single();
  var prenom = (result.data && result.data.prenom) ? result.data.prenom : session.data.session.user.email;
  document.querySelector('.dash-header p strong').textContent = prenom;
}

// -- FILE PREVIEW --
function previewFile(inputId, previewId, zoneId) {
  var file = document.getElementById(inputId).files[0];
  if (!file) return;
  document.getElementById(zoneId).classList.add('has-file');
  var preview = document.getElementById(previewId);
  if (file.type.indexOf('image')===0) {
    var reader = new FileReader();
    reader.onload = function(e){ preview.innerHTML='<img src="'+e.target.result+'" style="max-width:100%;max-height:180px;border-radius:8px;">'; };
    reader.readAsDataURL(file);
  } else {
    preview.innerHTML = '<div class="pdf-preview">PDF: '+file.name+'</div>';
  }
}

function printCD() {
  var c = document.getElementById('cd-print-area').innerHTML;
  var w = window.open('','_blank');
  w.document.write('<'+'html><head><title>Contre-devis</title></head><body>'+c+'<'+'/body><'+'/html>');
  w.document.close(); w.print();
}
function sendByMail() {
  var s = encodeURIComponent('Votre contre-devis LeDevisCo');
  var b = encodeURIComponent('Bonjour, voici votre contre-devis debloque sur LeDevisCo.');
  window.location.href = 'mailto:?subject='+s+'&body='+b;
}
function filterAnnonces() { loadAnnonces(); }

// -- CONFIDENTIALITE UPLOAD --
var pendingUploadAction = null;

function openConfidModal() {
  document.getElementById('confid-check').checked = false;
  document.getElementById('btn-confid-ok').classList.remove('enabled');
  openModal('modal-confidential');
}

function toggleConfidBtn() {
  var checked = document.getElementById('confid-check').checked;
  var btn = document.getElementById('btn-confid-ok');
  if (checked) btn.classList.add('enabled');
  else btn.classList.remove('enabled');
}

function toggleConfidCheck() {
  var cb = document.getElementById('confid-check');
  cb.checked = !cb.checked;
  toggleConfidBtn();
}

var uploadConfirmed = false;
function confirmUpload() {
  var checked = document.getElementById('confid-check').checked;
  if (!checked) return;
  var m = document.getElementById('modal-confidential');
  m.classList.remove('open');
  m.style.display = 'none';
  uploadConfirmed = true;
  setTimeout(function() {
    document.getElementById('file-devis').click();
    setTimeout(function() {
      m.style.display = '';
      uploadConfirmed = false;
    }, 2000);
  }, 150);
}

// -- CONFIRMATION FINALE avant publication --
function openFinalConfidModal() {
  document.getElementById('final-check').checked = false;
  document.getElementById('btn-final-ok').classList.remove('enabled');
  openModal('modal-final-confirm');
}
function toggleFinalCheck() {
  var cb = document.getElementById('final-check');
  cb.checked = !cb.checked;
  toggleFinalBtn();
}
function toggleFinalBtn() {
  var checked = document.getElementById('final-check').checked;
  var btn = document.getElementById('btn-final-ok');
  if (checked) btn.classList.add('enabled');
  else btn.classList.remove('enabled');
}
function doConfirmedPublish() {
  var checked = document.getElementById('final-check').checked;
  if (!checked) return;
  closeModal('modal-final-confirm');
  doPublishDevis();
}

async function doPublishDevis() {
  var titre = document.getElementById('f-titre').value;
  var montant = document.getElementById('f-montant').value;
  var email = document.getElementById('f-email').value;
  var cat = document.getElementById('f-cat').value;
  var region = document.getElementById('f-region').value;
  var departement = document.getElementById('f-dep').value || '';
  var desc = document.getElementById('f-desc').value;
  var detail = document.getElementById('f-detail').value;
  var numdevis = document.getElementById('f-numdevis').value;
  var datedevis = document.getElementById('f-datedevis').value;
  var entreprise = document.getElementById('f-entreprise').value;
  var fileInput = document.getElementById('file-devis');
  var file = fileInput && fileInput.files[0] ? fileInput.files[0] : null;

  if (!titre||!montant||!email||!cat||!region) {
    toast('Remplissez tous les champs obligatoires','error');
    return;
  }

  var btn = document.querySelector('#poster .submit-btn');
  btn.textContent = 'Upload en cours...';
  btn.disabled = true;

  var fichierUrl = null;
  if (file) {
    fichierUrl = await uploadFile(file, 'devis-files');
    if (!fichierUrl) {
      toast('Erreur upload fichier','error');
      btn.textContent = 'Publier mon annonce';
      btn.disabled = false;
      return;
    }
  }

  btn.textContent = 'Publication en cours...';
  var data = {
    titre: titre, montant: parseFloat(montant), email_auteur: email,
    categorie: cat, region: region, description: desc, detail: detail,
    numero_devis: numdevis, date_devis: datedevis || null,
    nom_entreprise: entreprise, fichier_url: fichierUrl, statut: 'ouvert'
  };

  var result = await sb.from('devis').insert([data]);
  btn.textContent = 'Publier mon annonce';
  btn.disabled = false;

  if (result.error) {
    toast('Erreur : ' + result.error.message, 'error');
  } else {
    toast('Annonce publiee avec succes !');
    document.getElementById('f-titre').value='';
    document.getElementById('f-montant').value='';
    document.getElementById('f-email').value='';
    document.getElementById('f-desc').value='';
    if (fileInput) fileInput.value='';
    document.getElementById('preview-devis').innerHTML='';
    setTimeout(function(){ showSection('annonces'); }, 1500);
  }
}

// -- PDF VIEWER apres deblocage --
var currentCDFileUrl = null;

function unlockCoords() {
  closeModal('modal-unlock');
  // Show PDF if available
  var frame = document.getElementById('cd-pdf-frame');
  var noPdf = document.getElementById('cd-no-pdf');
  var pdfLink = document.getElementById('cd-pdf-link');
  if (currentCDFileUrl) {
    frame.src = currentCDFileUrl;
    frame.style.display = 'block';
    noPdf.style.display = 'none';
    pdfLink.href = currentCDFileUrl;
    pdfLink.style.display = 'inline-flex';
  } else {
    frame.style.display = 'none';
    noPdf.style.display = 'block';
    pdfLink.style.display = 'none';
  }
  openModal('modal-cd-viewer');
}

var DEPS_BY_REGION = {
  "Auvergne-Rhone-Alpes": ["01 - Ain","03 - Allier","07 - Ardeche","15 - Cantal","26 - Drome","38 - Isere","42 - Loire","43 - Haute-Loire","63 - Puy-de-Dome","69 - Rhone","73 - Savoie","74 - Haute-Savoie"],
  "Bourgogne-Franche-Comte": ["21 - Cote-d Or","25 - Doubs","39 - Jura","58 - Nievre","70 - Haute-Saone","71 - Saone-et-Loire","89 - Yonne","90 - Territoire de Belfort"],
  "Bretagne": ["22 - Cotes-d Armor","29 - Finistere","35 - Ille-et-Vilaine","56 - Morbihan"],
  "Centre-Val de Loire": ["18 - Cher","28 - Eure-et-Loir","36 - Indre","37 - Indre-et-Loire","41 - Loir-et-Cher","45 - Loiret"],
  "Corse": ["2A - Corse-du-Sud","2B - Haute-Corse"],
  "Grand Est": ["08 - Ardennes","10 - Aube","51 - Marne","52 - Haute-Marne","54 - Meurthe-et-Moselle","55 - Meuse","57 - Moselle","67 - Bas-Rhin","68 - Haut-Rhin","88 - Vosges"],
  "Hauts-de-France": ["02 - Aisne","59 - Nord","60 - Oise","62 - Pas-de-Calais","80 - Somme"],
  "Ile-de-France": ["75 - Paris","77 - Seine-et-Marne","78 - Yvelines","91 - Essonne","92 - Hauts-de-Seine","93 - Seine-Saint-Denis","94 - Val-de-Marne","95 - Val-d Oise"],
  "Normandie": ["14 - Calvados","27 - Eure","50 - Manche","61 - Orne","76 - Seine-Maritime"],
  "Nouvelle-Aquitaine": ["16 - Charente","17 - Charente-Maritime","19 - Correze","23 - Creuse","24 - Dordogne","33 - Gironde","40 - Landes","47 - Lot-et-Garonne","64 - Pyrenees-Atlantiques","79 - Deux-Sevres","86 - Vienne","87 - Haute-Vienne"],
  "Occitanie": ["09 - Ariege","11 - Aude","12 - Aveyron","30 - Gard","31 - Haute-Garonne","32 - Gers","34 - Herault","46 - Lot","48 - Lozere","65 - Hautes-Pyrenees","66 - Pyrenees-Orientales","81 - Tarn","82 - Tarn-et-Garonne"],
  "Pays de la Loire": ["44 - Loire-Atlantique","49 - Maine-et-Loire","53 - Mayenne","72 - Sarthe","85 - Vendee"],
  "Provence-Alpes-Cote d Azur": ["04 - Alpes-de-Haute-Provence","05 - Hautes-Alpes","06 - Alpes-Maritimes","13 - Bouches-du-Rhone","83 - Var","84 - Vaucluse"],
  "DOM-TOM": ["971 - Guadeloupe","972 - Martinique","973 - Guyane","974 - La Reunion","976 - Mayotte","975 - Saint-Pierre-et-Miquelon","977 - Saint-Barthelemy","978 - Saint-Martin","986 - Wallis-et-Futuna","987 - Polynesie francaise","988 - Nouvelle-Caledonie"],
};

function updateDeps(regionId, depId) {
  var region = document.getElementById(regionId).value;
  var depSelect = document.getElementById(depId);
  depSelect.innerHTML = '';
  if (!region) {
    depSelect.innerHTML = '<option value="">-- Choisir region d abord --</option>';
    // If it's the filter, reload annonces with no region filter
    if (regionId === 'filter-region') loadAnnonces();
    return;
  }
  var deps = DEPS_BY_REGION[region] || [];
  var firstOpt = (regionId === 'filter-region') ? '<option value="">Tous les departements</option>' : '<option value="">Selectionnez le departement</option>';
  var html = firstOpt;
  for (var i=0; i<deps.length; i++) {
    html += '<option>' + deps[i] + '</option>';
  }
  depSelect.innerHTML = html;
  // If filter, add onchange to reload annonces on dep selection
  if (regionId === 'filter-region') {
    depSelect.onchange = function() { loadAnnonces(); };
    // Also reload with region filter immediately
    loadAnnonces();
  }
}

// -- INIT --
document.addEventListener('DOMContentLoaded', function() {
  // Detect Supabase auth redirect in URL
  var hash = window.location.hash;
  if (hash) {
    if (hash.includes('access_token')) {
      // Email confirmed successfully
      setTimeout(function() {
        toast('Email confirme ! Vous pouvez maintenant vous connecter.');
        showSection('auth');
      }, 500);
    } else if (hash.includes('error=access_denied') || hash.includes('otp_expired')) {
      setTimeout(function() {
        toast('Ce lien a expire. Veuillez vous reconnecter pour en recevoir un nouveau.', 'error');
        showSection('auth');
      }, 500);
    }
    // Clean URL
    history.replaceState(null, '', window.location.pathname);
  }

  loadAnnonces();

  // Maintenir la session active en permanence
  sb.auth.onAuthStateChange(function(event, session) {
    if (event === 'SIGNED_OUT') {
      // Ne pas rediriger automatiquement, juste mettre a jour l'UI
    }
  });

  // Restaurer la session au chargement
  sb.auth.getSession().then(function(result) {
    if (result.data.session) {
      // Session active - rien a faire
    }
  });

  var overlays = document.querySelectorAll('.modal-overlay');
  for (var i=0; i<overlays.length; i++) {
    overlays[i].addEventListener('click', function(e){
      if (e.target===this) this.classList.remove('open');
    });
  }

  // Verification paiement au retour de Stripe
  var params = new URLSearchParams(window.location.search);
  if (params.get('payment') === 'success') {
    toast('Paiement confirme ! Les coordonnees sont debloquees.', 'success');
    showSection('dashboard');
    history.replaceState({}, '', '/');
  } else if (params.get('payment') === 'cancel') {
    toast('Paiement annule.', 'error');
    history.replaceState({}, '', '/');
  }
});

