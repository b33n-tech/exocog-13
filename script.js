// --- Elements ---
const taskInput = document.getElementById("taskInput");
const addBtn = document.getElementById("addBtn");
const archiveBtn = document.getElementById("archiveBtn");
const tasksContainer = document.getElementById("tasksContainer");
const copiedMsg = document.getElementById("copiedMsg");
const clearBtn = document.getElementById("clearBtn");
const restoreBtn = document.getElementById("restoreBtn");
const restoreInput = document.getElementById("restoreInput");
const jsonPaste = document.getElementById("jsonPaste");
const sendToLLMBtn = document.getElementById("sendToLLMBtn");
const llmSelect = document.getElementById("llmSelect");

// Modules
const jalonsList = document.getElementById("jalonsList");
const messagesTableBody = document.querySelector("#messagesTable tbody");
const livrablesList = document.getElementById("livrablesList");
const generateMailBtn = document.getElementById("generateMailBtn");
const mailPromptSelect = document.getElementById("mailPromptSelect");
const generateLivrableBtn = document.getElementById("generateLivrableBtn");
const livrablePromptSelect = document.getElementById("livrablePromptSelect");

// --- Storage ---
let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
let llmData = null;

// --- Utils ---
function formatDate(iso){
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
}

// --- Render Tasks ---
function renderTasks(){
  tasksContainer.innerHTML = "";
  tasks.forEach((task,i)=>{
    const li = document.createElement("li");
    li.className = "task-item";

    const taskText = document.createElement("div");
    taskText.className = "task-text";
    taskText.textContent = task.text + " (" + task.date.split("T")[0] + ")";
    li.appendChild(taskText);

    // Commentaire
    const commentBlock = document.createElement("div");
    commentBlock.className = "comment-section";
    const commentList = document.createElement("ul");
    if(task.comments?.length){
      task.comments.forEach(c=>{
        const cLi = document.createElement("li");
        cLi.textContent = `[${formatDate(c.date)}] ${c.text}`;
        commentList.appendChild(cLi);
      });
    }
    commentBlock.appendChild(commentList);

    const commentInput = document.createElement("input");
    commentInput.placeholder = "Ajouter un commentaire…";
    const commentBtn = document.createElement("button");
    commentBtn.textContent = "+";
    commentBtn.addEventListener("click", ()=>{
      const val = commentInput.value.trim();
      if(val!==""){
        if(!task.comments) task.comments=[];
        task.comments.push({text: val, date: new Date().toISOString()});
        localStorage.setItem("tasks",JSON.stringify(tasks));
        commentInput.value="";
        renderTasks();
      }
    });
    commentBlock.appendChild(commentInput);
    commentBlock.appendChild(commentBtn);
    li.appendChild(commentBlock);

    tasksContainer.appendChild(li);
  });
}

// --- Add Task ---
addBtn.addEventListener("click",()=>{
  const text = taskInput.value.trim();
  if(text!==""){
    tasks.push({text,date:new Date().toISOString(),comments:[]});
    localStorage.setItem("tasks",JSON.stringify(tasks));
    taskInput.value="";
    renderTasks();
  }
});

// --- Clear Tasks ---
clearBtn.addEventListener("click",()=>{
  if(confirm("Es-tu sûr ?")){
    tasks = [];
    localStorage.removeItem("tasks");
    renderTasks();
  }
});

// --- Archive Tasks ---
archiveBtn.addEventListener("click",()=>{
  if(tasks.length===0){alert("Aucune tâche à archiver !"); return;}
  const blob = new Blob([JSON.stringify(tasks,null,2)],{type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `taches_${new Date().toISOString().slice(0,19).replace(/:/g,"-")}.json`;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// --- Restore ---
restoreBtn.addEventListener("click",()=>restoreInput.click());
restoreInput.addEventListener("change", e=>{
  const file = e.target.files[0];
  if(file){
    const reader = new FileReader();
    reader.onload = e=>{
      try{
        const data = JSON.parse(e.target.result);
        if(Array.isArray(data)) tasks.push(...data);
        localStorage.setItem("tasks",JSON.stringify(tasks));
        renderTasks();
      }catch(err){alert("JSON invalide !");}
    };
    reader.readAsText(file);
  }
});

// --- Build Prompt ---
function buildPrompt(inputText){
  return `
Tu es un assistant de gestion de projet. Voici des tâches/commentaires à traiter :
${inputText}

- Identifie toutes les tâches et micro-actions implicites/explicites.
- Identifie les dépendances.
- Génère un JSON strictement sous ce format :
{
  "jalons":[{"titre":"","datePrévue":"","sousActions":[{"texte":"","statut":""}]}],
  "messages":[{"destinataire":"","sujet":"","texte":"","envoyé":false}],
  "rdv":[{"titre":"","date":"","durée":"","participants":[""]}],
  "autresModules":[{"titre":"","items":[{"nom":"","lien":""}]}],
  "livrables":[{"titre":"","type":"","template":{}}]
}
`;
}

// --- Push au LLM ---
sendToLLMBtn.addEventListener("click", ()=>{
  const inputText = jsonPaste.value.trim();
  if(!inputText){alert("Colle d'abord le texte ou JSON"); return;}
  const prompt = buildPrompt(inputText);
  navigator.clipboard.writeText(prompt).then(()=> window.open(llmSelect.value,"_blank"));
});

// --- Populate Modules ---
function populateModules(){
  if(!llmData) return;
  // Jalons
  jalonsList.innerHTML="";
  llmData.jalons?.forEach(j=>{
    const li=document.createElement("li");
    li.innerHTML=`<strong>${j.titre}</strong> (${j.datePrévue})<ul>${j.sousActions?.map(sa=>`<li><input type="checkbox"> ${sa.texte} (${sa.statut})</li>`).join('')}</ul>`;
    jalonsList.appendChild(li);
  });

  // Messages
  messagesTableBody.innerHTML="";
  llmData.messages?.forEach((m,i)=>{
    const tr=document.createElement("tr");
    tr.innerHTML=`<td><input type="checkbox"></td><td>${m.destinataire}</td><td>${m.sujet}</td><td>${m.texte}</td><td><input type="text" placeholder="Note…"></td>`;
    messagesTableBody.appendChild(tr);
  });

  // Livrables
  livrablesList.innerHTML="";
  llmData.livrables?.forEach((l,i)=>{
    const li=document.createElement("li");
    li.innerHTML=`<input type="checkbox"> ${l.titre} (${l.type}) <input type="text" placeholder="Note…">`;
    livrablesList.appendChild(li);
  });
}

// --- Generate LLM from modules ---
generateMailBtn.addEventListener("click",()=>{
  const selected = [];
  messagesTableBody.querySelectorAll("tr").forEach((tr,i)=>{
    if(tr.querySelector("input[type='checkbox']").checked){
      selected.push({...llmData.messages[i], note: tr.querySelector("input[type='text']").value});
    }
  });
  if(selected.length){
    navigator.clipboard.writeText(JSON.stringify(selected,null,2)).then(()=> window.open(mailPromptSelect.value,"_blank"));
  }
});

generateLivrableBtn.addEventListener("click",()=>{
  const selected = [];
  livrablesList.querySelectorAll("li").forEach((li,i)=>{
    if(li.querySelector("input[type='checkbox']").checked){
      selected.push({...llmData.livrables[i], note: li.querySelector("input[type='text']").value});
    }
  });
  if(selected.length){
    navigator.clipboard.writeText(JSON.stringify(selected,null,2)).then(()=> window.open(livrablePromptSelect.value,"_blank"));
  }
});

// --- Initial Render ---
renderTasks();
