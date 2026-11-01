(() => {
"use strict";
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const db=window.plottClient;
let user=null,profile=null,tab="overview",tasks=[],classes=[],assignments=[],submissions=[],videos=[],users=[],logs=[];
let timerTotal=25*60,timerRemaining=25*60,timerInterval=null,timerEnd=0;
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const dateText=s=>s?new Date(s).toLocaleString([],{month:"short",day:"numeric",hour:"numeric",minute:"2-digit"}):"No deadline";
const dateOnly=s=>s?new Date(s).toLocaleDateString([],{month:"short",day:"numeric"}):"";
const localDate=d=>{const x=new Date(d.getTime()-d.getTimezoneOffset()*60000);return x.toISOString().slice(0,16)};
function toast(s,error=false){const e=$("#toast");e.textContent=s;e.classList.toggle("error",error);e.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove("show"),3000)}
function log(action,details=""){if(!db||!user)return;db.from("system_logs").insert({user_id:user.id,action,details}).then(()=>{});}
function isTeacher(){return profile?.role==="Teacher"||profile?.role==="Admin"}function isAdmin(){return profile?.role==="Admin"}function isStudent(){return profile?.role==="Student"}
function showTab(name){const p=$("#tab-"+name);if(!p)return;tab=name;$$(".tab-panel").forEach(x=>x.classList.add("hidden"));p.classList.remove("hidden");$$("[data-tab]").forEach(x=>x.classList.toggle("active",x.dataset.tab===name));const nav=$(`[data-tab="${name}"]`);$("#currentTabName").textContent=nav?nav.innerText.trim():name;$("#sidebar").classList.remove("open");}
function empty(t){return `<div class="empty">${esc(t)}</div>`}
function badge(t,kind=""){return `<span class="badge ${kind}">${esc(t)}</span>`}
function roleUI(){
 $("#userName").textContent=profile.full_name||profile.email||"User";$("#userRole").textContent=profile.role;$("#avatar").textContent=(profile.full_name||profile.email||"S")[0].toUpperCase();
 document.body.dataset.theme=profile.theme||"light";$("#themeToggle").textContent=document.body.dataset.theme==="dark"?"☀":"☾";
 $$(".student-only").forEach(x=>x.classList.toggle("hidden",!isStudent()));
 $$(".teacher-only").forEach(x=>x.classList.toggle("hidden",!isTeacher()));
 $$(".admin-only").forEach(x=>x.classList.toggle("hidden",!isAdmin()));
 $("#personalTaskPanel").classList.toggle("hidden",!isStudent());$("#studentVideoUpload")?.classList.toggle("hidden",!isStudent());$("#assignTaskPanel").classList.toggle("hidden",!isTeacher());$("#joinClassPanel").classList.toggle("hidden",!isStudent());$("#videoAddPanel").classList.toggle("hidden",!isTeacher());
}
async function loadAll(){
 const queries=await Promise.all([
  db.from("tasks").select("*").order("created_at",{ascending:false}),
  db.from("classes").select("*, enrollments(student_id)"),
  db.from("assignments").select("*, classes(course_name)").order("due_date"),
  db.from("submissions").select("*, assignments(title,max_points), profiles:student_id(full_name,email)").order("submitted_at",{ascending:false}),
  db.from("study_videos").select("*").order("created_at",{ascending:false})
 ]);
 [tasks,classes,assignments,submissions,videos]=queries.map((q,i)=>{if(q.error)console.warn("Load",i,q.error.message);return q.data||[]});
 if(isAdmin()){const [u,l]=await Promise.all([db.from("profiles").select("id,full_name,email,role,theme").order("full_name"),db.from("system_logs").select("*, profiles: user_id(full_name,email)").order("created_at",{ascending:false}).limit(200)]);users=u.data||[];logs=l.data||[];}
 render();
}
function taskVisible(t){return isAdmin()?false:(isTeacher()?t.created_by===user.id||t.assigned_by===user.id||t.assigned_to===user.id:t.assigned_to===user.id||(!t.assigned_to&&t.created_by===user.id));}
function myTasks(){return tasks.filter(taskVisible)}
function myAssignments(){return isAdmin()?assignments:isTeacher()?assignments.filter(a=>a.teacher_id===user.id):assignments.filter(a=>classes.some(c=>c.id===a.class_id&&(c.enrollments||[]).some(e=>e.student_id===user.id)))}
function isDone(a){return (a.completed_by||[]).includes(user.id)}
function deadline(a){if(isDone(a))return badge("Completed","safe");let d=new Date(a.due_date)-Date.now();if(d<0)return badge("Overdue","late");if(d<86400000)return badge("Due soon","high");return badge("Upcoming","safe")}
function render(){
 roleUI();renderOverview();renderTasks();renderAssignments();renderClasses();renderVideos();if(isTeacher())renderSubmissions();if(isAdmin()){renderUsers();renderLogs();}fillStudentSelect();fillClassSelect();showTab(tab);
}
function renderOverview(){
 const ts=myTasks(),as=myAssignments(),doneT=ts.filter(t=>t.status==="Completed").length,doneA=as.filter(isDone).length,total=ts.length+as.length,done=doneT+doneA,due=as.filter(a=>!isDone(a)&&new Date(a.due_date)-Date.now()>=0&&new Date(a.due_date)-Date.now()<86400000).length;
 $("#statOpen").textContent=ts.length-doneT;$("#statAssignments").textContent=as.length;$("#statCompleted").textContent=done;$("#statDue").textContent=due;$("#progressPercent").textContent=(total?Math.round(done/total*100):0)+"%";$("#progressBar").style.width=(total?done/total*100:0)+"%";$("#progressSummary").textContent=`${done} of ${total} items complete`;$("#welcome").textContent=`Welcome back, ${(profile.full_name||"there").split(" ")[0]} 👋`;
 $("#overviewAssignments").innerHTML=as.slice(0,3).map(a=>`<div class="simple-item"><i class="dot"></i><div><strong>${esc(a.title)}</strong><small>Due ${esc(dateText(a.due_date))}</small></div>${deadline(a)}</div>`).join("")||empty("No assignments to show.");
 $("#overviewTasks").innerHTML=ts.filter(t=>t.status!=="Completed").slice(0,3).map(t=>`<div class="simple-item"><i class="dot"></i><div><strong>${esc(t.title)}</strong><small>${esc(t.course_name||"Personal study")}</small></div>${badge(t.priority,t.priority==="High"?"high":"")}</div>`).join("")||empty("No open tasks. Nice work!");
}
function renderTasks(){
 const filter=$("#taskFilter").value,ts=myTasks().filter(t=>filter==="all"||(filter==="open"&&t.status!=="Completed")||(filter==="completed"&&t.status==="Completed"));
 $("#taskList").innerHTML=ts.map(t=>`<div class="task-row ${t.status==="Completed"?"done":""}"><input type="checkbox" data-task-toggle="${t.id}" ${t.status==="Completed"?"checked":""} aria-label="Complete task"><div class="task-main"><strong>${esc(t.title)}</strong><small>${esc(t.course_name||"Personal study")} · ${t.assigned_to===user.id&&t.assigned_by?"Assigned by teacher":"Added "+dateOnly(t.created_at)} ${t.due_date?" · Due "+dateText(t.due_date):""}</small></div>${badge(t.priority,t.priority==="High"?"high":"")}${t.assigned_by&&isStudent()?badge("Teacher assigned"):""}${(isStudent()&&!t.assigned_by)||isTeacher()&&t.assigned_by===user.id?`<button class="delete-btn" data-task-edit="${t.id}" title="Edit task">✎</button><button class="delete-btn" data-task-delete="${t.id}" title="Delete task">✕</button>`:""}</div>`).join("")||empty("No tasks here yet. Add a task or wait for your teacher to assign one.");
}
function renderAssignments(){
 const as=myAssignments();
 $("#assignmentList").innerHTML=as.map(a=>`<article class="panel assignment-card"><div class="card-top"><span class="chip">${esc(a.classes?.course_name||"Class")}</span>${deadline(a)}</div><h2>${esc(a.title)}</h2><p>${esc(a.description||"No additional instructions.")}</p><div class="meta"><span>${a.max_points} points</span><span>Due ${esc(dateText(a.due_date))}</span></div><div class="card-actions">${isStudent()?`<button class="btn primary" data-submit="${a.id}">${submissions.some(s=>s.assignment_id===a.id&&s.student_id===user.id)?"Update submission":"Submit work"}</button><button class="btn outline" data-assignment-toggle="${a.id}">${isDone(a)?"Mark incomplete":"Mark complete"}</button>`:`<button class="btn outline" data-assignment-edit="${a.id}">Edit</button><button class="btn outline" data-assignment-status="${a.id}">View status</button>`}</div></article>`).join("")||empty("No assignments have been published to your classes.");
}
function renderClasses(){
 $("#classList").innerHTML=classes.filter(c=>isAdmin()||isTeacher()?isAdmin()||c.teacher_id===user.id: (c.enrollments||[]).some(e=>e.student_id===user.id)).map(c=>`<article class="panel class-card"><h2>${esc(c.course_name)}</h2><p>${(c.enrollments||[]).length} enrolled student(s)</p><div class="class-code">CODE: ${esc(c.enrollment_code)}</div><p class="meta">Teacher: ${esc(c.teacher_name||"Assigned teacher")}</p>${isTeacher()?`<button class="btn outline" data-class-members="${c.id}">View students</button>`:""}</article>`).join("")||empty("No classes available. Ask your teacher for an enrollment code.");
}
function youtubeEmbed(url){try{const u=new URL(url);let v=u.hostname==="youtu.be"?u.pathname.slice(1):u.searchParams.get("v")||u.pathname.match(/\/embed\/([^/]+)/)?.[1];return /^[\w-]{11}$/.test(v||"")?"https://www.youtube-nocookie.com/embed/"+v:null}catch{return null}}
function renderVideos(){$("#videoGrid").innerHTML=videos.map(v=>`<article class="panel video-card"><div class="video-frame">${youtubeEmbed(v.url)?`<iframe loading="lazy" src="${youtubeEmbed(v.url)}" title="${esc(v.title)}" allowfullscreen></iframe>`:"Invalid YouTube link"}</div><h2>${esc(v.title)}</h2><p>${esc(v.url)}</p><small class="muted">Assigned to: ${esc(v.assigned_to||"All students")}</small>${isTeacher()?`<button class="delete-btn" data-video-delete="${v.id}">Remove video</button>`:""}</article>`).join("")||empty("No study videos yet.");}
function renderSubmissions(){$("#submissionTable").innerHTML=submissions.map(s=>`<tr><td>${esc(s.profiles?.full_name||s.profiles?.email||"Student")}</td><td>${esc(s.assignments?.title||"Assignment")}</td><td>${esc(dateText(s.submitted_at))}<br>${esc(s.submission_label||"")}</td><td>${s.grade_achieved===null?"Not graded":`${s.grade_achieved}/${s.assignments?.max_points}`}</td><td><button class="table-action" data-grade="${s.id}">Grade</button></td></tr>`).join("")||`<tr><td colspan="5">No submissions recorded yet.</td></tr>`;}
function renderUsers(){$("#usersTable").innerHTML=users.map(u=>`<tr><td>${esc(u.full_name)}</td><td>${esc(u.email)}</td><td><select data-user-role="${u.id}"><option ${u.role==="Student"?"selected":""}>Student</option><option ${u.role==="Teacher"?"selected":""}>Teacher</option><option ${u.role==="Admin"?"selected":""}>Admin</option></select></td><td><button class="table-action" data-save-role="${u.id}">Save role</button></td></tr>`).join("")||`<tr><td colspan="4">No users.</td></tr>`;}
function renderLogs(){$("#logsTable").innerHTML=logs.map(l=>`<tr><td>${esc(dateText(l.created_at))}</td><td>${esc(l.profiles?.email||"")}</td><td>${esc(l.action)}</td><td>${esc(l.details||"")}</td></tr>`).join("")||`<tr><td colspan="4">No logs recorded.</td></tr>`;}
function fillStudentSelect(){const studentUsers=users.length?users.filter(u=>u.role==="Student"):[];$("#assignedStudent").innerHTML=studentUsers.map(u=>`<option value="${u.id}">${esc(u.full_name||u.email)}</option>`).join("");}
function fillClassSelect(){$("#assignmentClass").innerHTML=classes.filter(c=>isAdmin()||c.teacher_id===user.id).map(c=>`<option value="${c.id}">${esc(c.course_name)}</option>`).join("");}
async function reload(){await loadAll();}
async function createPersonalTask(e){e.preventDefault();if(!isStudent())return toast("Only students can create personal tasks.",true);const title=$("#taskTitle").value.trim();if(!title)return toast("Task title is required.",true);const {error}=await db.from("tasks").insert({title,course_name:$("#taskCourse").value.trim(),priority:$("#taskPriority").value,status:"To-Do",created_by:user.id,assigned_to:user.id});if(error)return toast(error.message,true);log("Task created",title);$("#taskForm").reset();await reload();toast("Task saved.");}
async function assignTask(e){e.preventDefault();if(!isTeacher())return toast("Only teachers can assign tasks.",true);const title=$("#assignedTaskTitle").value.trim(),student=$("#assignedStudent").value;if(!title||!student)return toast("Choose a title and student.",true);const due=$("#assignedDue").value?new Date($("#assignedDue").value).toISOString():null;const {error}=await db.from("tasks").insert({title,course_name:$("#assignedCourse").value.trim(),priority:"Normal",status:"To-Do",created_by:user.id,assigned_by:user.id,assigned_to:student,due_date:due});if(error)return toast(error.message,true);log("Task assigned",title);$("#assignTaskForm").reset();await reload();toast("Task assigned to student.");}
async function toggleTask(id){const t=tasks.find(x=>x.id===id);if(!t||isAdmin())return;const {error}=await db.from("tasks").update({status:t.status==="Completed"?"To-Do":"Completed"}).eq("id",id);if(error)return toast(error.message,true);log("Task status changed",t.title);await reload();}
async function deleteTask(id){const t=tasks.find(x=>x.id===id);if(!t||!confirm(`Delete “${t.title}”?`))return;const {error}=await db.from("tasks").delete().eq("id",id);if(error)return toast(error.message,true);log("Task deleted",t.title);await reload();toast("Task deleted.");}
function openAssignment(a=null){const own=classes.filter(c=>isAdmin()||c.teacher_id===user.id);if(!own.length)return toast("Create a class first.",true);$("#assignmentForm").dataset.editId=a?.id||"";$("#assignmentTitle").value=a?.title||"";fillClassSelect();$("#assignmentClass").value=a?.class_id||own[0].id;$("#assignmentDescription").value=a?.description||"";$("#assignmentPoints").value=a?.max_points||100;$("#assignmentDue").value=a?.due_date?localDate(new Date(a.due_date)):localDate(new Date(Date.now()+3*86400000));$("#assignmentDialog").showModal();}
async function saveAssignment(e){e.preventDefault();if(!isTeacher())return;const data={title:$("#assignmentTitle").value.trim(),class_id:$("#assignmentClass").value,description:$("#assignmentDescription").value.trim(),max_points:Number($("#assignmentPoints").value),due_date:new Date($("#assignmentDue").value).toISOString(),teacher_id:user.id};const editId=$("#assignmentForm").dataset.editId;let res=editId?await db.from("assignments").update(data).eq("id",editId):await db.from("assignments").insert(data);if(res.error)return toast(res.error.message,true);log(editId?"Assignment edited":"Assignment created",data.title);$("#assignmentDialog").close();await reload();toast("Assignment saved.");}
async function saveClass(e){e.preventDefault();if(!isTeacher())return;const course_name=$("#className").value.trim(),enrollment_code=$("#classCode").value.trim().toUpperCase();if(!course_name||!enrollment_code)return toast("Enter class name and code.",true);const {error}=await db.from("classes").insert({course_name,enrollment_code,teacher_id:user.id,teacher_name:profile.full_name});if(error)return toast(error.message,true);log("Class created",course_name);$("#classDialog").close();$("#classForm").reset();await reload();}
async function joinClass(e){e.preventDefault();const code=$("#enrollmentCode").value.trim().toUpperCase(),c=classes.find(x=>x.enrollment_code.toUpperCase()===code);if(!c)return toast("Class code not found. Refresh and try again.",true);const {error}=await db.from("enrollments").upsert({class_id:c.id,student_id:user.id},{onConflict:"class_id,student_id"});if(error)return toast(error.message,true);log("Joined class",c.course_name);await reload();toast("You joined the class.");}
function openSubmit(aid){const a=assignments.find(x=>x.id===aid);if(!a)return;$("#submitAssignmentId").value=aid;$("#submitContext").textContent=`${a.title} · Due ${dateText(a.due_date)}`;$("#submissionLabel").value="";$("#submitDialog").showModal();}
async function submitWork(e){e.preventDefault();const assignment_id=$("#submitAssignmentId").value,submission_label=$("#submissionLabel").value.trim();if(!submission_label)return toast("Enter a submission note or filename.",true);const {error}=await db.from("submissions").upsert({assignment_id,student_id:user.id,submission_label,submitted_at:new Date().toISOString(),grade_achieved:null,feedback_text:""},{onConflict:"assignment_id,student_id"});if(error)return toast(error.message,true);log("Assignment submitted",submission_label);$("#submitDialog").close();await reload();toast("Submission status saved.");}
async function toggleAssignment(aid){const a=assignments.find(x=>x.id===aid);if(!a||!isStudent())return;const done=a.completed_by||[],next=done.includes(user.id)?done.filter(x=>x!==user.id):[...done,user.id];const {error}=await db.from("assignments").update({completed_by:next}).eq("id",aid);if(error)return toast(error.message,true);await reload();}
async function gradeSubmission(sid){const s=submissions.find(x=>x.id===sid);if(!s)return;$("#gradeSubmissionId").value=sid;$("#gradeContext").textContent=`${s.profiles?.full_name||"Student"} · ${s.assignments?.title||"Assignment"}`;$("#gradeValue").max=s.assignments?.max_points||100;$("#gradeValue").value=s.grade_achieved??"";$("#gradeFeedback").value=s.feedback_text||"";$("#gradeDialog").showModal();}
async function saveGrade(e){e.preventDefault();if(!isTeacher())return;const sid=$("#gradeSubmissionId").value,s=submissions.find(x=>x.id===sid),grade=Number($("#gradeValue").value);if(!s||grade<0||grade>Number(s.assignments?.max_points||100))return toast("Grade is outside the allowed range.",true);const {error}=await db.from("submissions").update({grade_achieved:grade,feedback_text:$("#gradeFeedback").value.trim()}).eq("id",sid);if(error)return toast(error.message,true);log("Submission graded",`${grade} points`);$("#gradeDialog").close();await reload();toast("Grade saved.");}
async function createVideo(e){e.preventDefault();if(!isTeacher())return;const title=$("#videoTitle").value.trim(),url=$("#videoUrl").value.trim(),student=$("#videoStudent")?.value.trim()||"";if(!title||!youtubeEmbed(url))return toast("Enter a valid YouTube link.",true);if(!db){videos.unshift({id:"demo-video-"+Date.now(),title,url,assigned_to:student||"All students",created_by:user.id});localStorage.setItem("plottDemoVideos",JSON.stringify(videos));$("#videoForm").reset();renderVideos();return toast("Video assigned in demo mode.");}const {error}=await db.from("study_videos").insert({title,url,created_by:user.id,assigned_to:student||null});if(error)return toast(error.message,true);log("Study video added",title);$("#videoForm").reset();await reload();}
async function createUser(e){e.preventDefault();if(!isAdmin())return;const email=$("#newUserEmail").value.trim().toLowerCase(),password=$("#newUserPassword").value,full_name=$("#newUserName").value.trim(),role=$("#newUserRole").value;if(password.length<8)return toast("Password must be at least 8 characters.",true);const {data,error}=await db.functions.invoke("admin-create-user",{body:{email,password,full_name,role}});if(error)return toast("Admin user creation needs the admin-create-user Edge Function: "+error.message,true);log("User created",email);$("#userForm").reset();await reload();toast("User created.");}
async function changeRole(id){if(!isAdmin())return;const role=$(`[data-user-role="${id}"]`).value;const {error}=await db.from("profiles").update({role}).eq("id",id);if(error)return toast(error.message,true);log("User role changed",`${id}: ${role}`);await reload();}
async function deleteVideo(id){if(!confirm("Remove this video?"))return;const {error}=await db.from("study_videos").delete().eq("id",id);if(error)return toast(error.message,true);await reload();}
function timerRender(){const m=Math.floor(timerRemaining/60),s=timerRemaining%60;$("#timerDisplay").textContent=`${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;}
function timerStop(completed=false){clearInterval(timerInterval);timerInterval=null;$("#timerStart").textContent="▶ Start";$("#timerStatus").textContent=completed?"Session complete!":"Timer paused";if(completed){timerRemaining=0;timerRender();toast("Focus session complete. Take a short break!");}}
function timerStart(){if(timerInterval){clearInterval(timerInterval);timerInterval=null;$("#timerStart").textContent="▶ Resume";$("#timerStatus").textContent="Paused";return;}if(timerRemaining<=0)timerRemaining=timerTotal;timerEnd=Date.now()+timerRemaining*1000;$("#timerStart").textContent="Ⅱ Pause";$("#timerStatus").textContent="Focus time";timerInterval=setInterval(()=>{timerRemaining=Math.max(0,Math.ceil((timerEnd-Date.now())/1000));timerRender();if(timerRemaining<=0)timerStop(true);},250);}
function timerReset(){clearInterval(timerInterval);timerInterval=null;timerRemaining=timerTotal;timerRender();$("#timerStart").textContent="▶ Start";$("#timerStatus").textContent="Ready to focus";}
async function toggleTheme(){const theme=document.body.dataset.theme==="dark"?"light":"dark";document.body.dataset.theme=theme;$("#themeToggle").textContent=theme==="dark"?"☀":"☾";if(!db){profile.theme=theme;localStorage.setItem("plottDemoSession",JSON.stringify(profile));return;}const {error}=await db.from("profiles").update({theme}).eq("id",user.id);if(error)toast("Theme changed for this page but could not save to your account.",true);else profile.theme=theme;}
async function init(){
 if(!db){
  const raw=localStorage.getItem("plottDemoSession");
  if(!raw){location.href="login.html";return;}
  user=JSON.parse(raw);profile={...user};
  tasks=[
   {id:"demo-task-1",title:"Review today's study notes",status:"In Progress",created_by:user.id,assigned_to:user.id,created_at:new Date().toISOString()},
   {id:"demo-task-2",title:"Finish project outline",status:"Completed",created_by:user.id,assigned_to:user.id,created_at:new Date().toISOString()},
   {id:"demo-task-3",title:"Prepare for weekly quiz",status:"Pending",created_by:user.id,assigned_to:user.id,created_at:new Date().toISOString()}
  ];
  classes=[];assignments=[];submissions=[];videos=JSON.parse(localStorage.getItem("plottDemoVideos")||"[]");users=[];logs=[];
  render();
  toast("Demo mode: changes are stored only in this browser session.");
  return;
 }
 const {data:{session},error}=await db.auth.getSession();if(error||!session){location.href="login.html";return;}user=session.user;
 const {data:p,error:pe}=await db.from("profiles").select("*").eq("id",user.id).single();if(pe||!p){toast("Profile not found. Please register again or contact your admin.",true);return;}profile=p;
 if(profile.theme)document.body.dataset.theme=profile.theme;
 const {data:enrolls}=await db.from("enrollments").select("class_id").eq("student_id",user.id);
 await loadAll();
 db.auth.onAuthStateChange((event)=>{if(event==="SIGNED_OUT")location.href="login.html";});
}
document.addEventListener("click",async e=>{
 const nav=e.target.closest("[data-tab]");if(nav)return showTab(nav.dataset.tab);
 const go=e.target.closest("[data-go]");if(go)return showTab(go.dataset.go);
 const close=e.target.closest("[data-close]");if(close)return $(`#${close.dataset.close}`).close();
 const tt=e.target.closest("[data-task-toggle]");if(tt)return toggleTask(tt.dataset.taskToggle);
 const td=e.target.closest("[data-task-delete]");if(td)return deleteTask(td.dataset.taskDelete);
 const te=e.target.closest("[data-task-edit]");if(te){const t=tasks.find(x=>x.id===te.dataset.taskEdit);if(!t)return;const title=prompt("Edit task title",t.title);if(title===null)return;if(!title.trim())return toast("Task title cannot be blank.",true);const {error}=await db.from("tasks").update({title:title.trim()}).eq("id",t.id);if(error)return toast(error.message,true);await reload();return;}
 const at=e.target.closest("[data-assignment-toggle]");if(at)return toggleAssignment(at.dataset.assignmentToggle);
 const sb=e.target.closest("[data-submit]");if(sb)return openSubmit(sb.dataset.submit);
 const ae=e.target.closest("[data-assignment-edit]");if(ae)return openAssignment(assignments.find(a=>a.id===ae.dataset.assignmentEdit));
 const av=e.target.closest("[data-assignment-status]");if(av){showTab("submissions");return;}
 const gr=e.target.closest("[data-grade]");if(gr)return gradeSubmission(gr.dataset.grade);
 const vd=e.target.closest("[data-video-delete]");if(vd)return deleteVideo(vd.dataset.videoDelete);
 const cr=e.target.closest("#createAssignmentBtn");if(cr)return openAssignment();
 if(e.target.closest("#createClassBtn"))return $("#classDialog").showModal();
 if(e.target.closest("#quickTask")){showTab("tasks");$("#taskTitle").focus();return;}
 if(e.target.closest("#themeToggle"))return toggleTheme();
 if(e.target.closest("#mobileMenu"))return $("#sidebar").classList.toggle("open");
 if(e.target.closest("#logoutBtn")){if(db)await db.auth.signOut();else localStorage.removeItem("plottDemoSession");location.href="login.html";}
 if(e.target.closest("#timerStart"))return timerStart();
 if(e.target.closest("#timerReset"))return timerReset();
 const preset=e.target.closest("[data-minutes]");if(preset){$$("[data-minutes]").forEach(b=>b.classList.toggle("selected",b===preset));timerTotal=Number(preset.dataset.minutes)*60;timerReset();}
 const role=e.target.closest("[data-save-role]");if(role)return changeRole(role.dataset.saveRole);
 const mem=e.target.closest("[data-class-members]");if(mem){const c=classes.find(x=>x.id===mem.dataset.classMembers);alert(`${c.course_name}\nEnrollment code: ${c.enrollment_code}\nEnrolled students: ${(c.enrollments||[]).length}`);}
});
$("#taskForm").addEventListener("submit",createPersonalTask);$("#assignTaskForm").addEventListener("submit",assignTask);$("#taskFilter").addEventListener("change",renderTasks);$("#assignmentForm").addEventListener("submit",saveAssignment);$("#classForm").addEventListener("submit",saveClass);$("#joinClassForm").addEventListener("submit",joinClass);$("#submitForm").addEventListener("submit",submitWork);$("#gradeForm").addEventListener("submit",saveGrade);$("#videoForm").addEventListener("submit",createVideo);$("#userForm").addEventListener("submit",createUser);
window.addEventListener("DOMContentLoaded",init);
})();