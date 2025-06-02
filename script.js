// ✅ script.js mit allen überarbeiteten Features

console.log("✅ script.js wurde geladen");
document.addEventListener("DOMContentLoaded", function () {
    const input = document.getElementById("todo-input");
    const dateInput = document.getElementById("todo-date");
    const addButton = document.getElementById("add-btn");
    const undoButton = document.getElementById("undo-btn");
    const redoButton = document.getElementById("redo-btn");
    const todoList = document.getElementById("todo-list");
    const toggleThemeButton = document.getElementById("toggle-theme");

    let undoStack = [];
    let redoStack = [];

    toggleThemeButton.addEventListener("click", function () {
        document.body.classList.toggle("dark-mode");
        toggleThemeButton.classList.toggle("dark-mode");
    });

    function pushUndo(action) {
        undoStack.push(action);
        redoStack = [];
    }

    function loadTasks() {
        const tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        tasks.sort((a, b) => a.priority - b.priority || new Date(a.date) - new Date(b.date));
        todoList.innerHTML = "";

        const grouped = {};

        tasks.forEach(task => {
            if (task.parent) {
                if (!grouped[task.parent]) grouped[task.parent] = [];
                grouped[task.parent].push(task);
            }
        });

        tasks.forEach(task => {
            if (task.parent) return;

            const group = document.createElement("div");
            group.classList.add("collapsible-task");

            const header = document.createElement("div");
            header.classList.add("collapsible-header");
            header.textContent = task.text;

            const subList = document.createElement("ul");
            subList.classList.add("collapsible-subtasks");

            addTaskToDOM(task.text, task.date, task.priority, task.done, group);

            if (grouped[task.text]) {
                grouped[task.text].forEach(sub => {
                    addTaskToDOM(sub.text, sub.date, sub.priority, sub.done, subList);
                });

                header.addEventListener("click", () => {
                    subList.style.display = subList.style.display === "block" ? "none" : "block";
                    header.classList.toggle("expanded");
                });

                group.appendChild(header);
                group.appendChild(subList);
                todoList.appendChild(group);
            } else {
                todoList.appendChild(group.firstChild);
            }
        });
    }

    function addTaskToDOM(text, date, priority = 1, done = false, parent = todoList) {
        const li = document.createElement("li");
        li.dataset.priority = priority;
        li.dataset.done = done;
        li.dataset.taskDate = date;

        li.classList.add(priority === 1 ? "high" : priority === 2 ? "medium" : "low");
        if (done) li.classList.add("done");

        const taskSpan = document.createElement("span");
        taskSpan.textContent = text;
        taskSpan.addEventListener("click", () => toggleTaskDone(li));

        const dateSpan = document.createElement("span");
        dateSpan.textContent = date ? `🕒 ${formatDate(date)}` : "Kein Datum";
        dateSpan.classList.add("date");

        const prioritySpan = document.createElement("span");
        prioritySpan.textContent = `⭐ Priorität: ${priority}`;
        prioritySpan.classList.add("priority");

        const editBtn = document.createElement("button");
        editBtn.textContent = "✏️";
        editBtn.classList.add("edit-btn");
        editBtn.addEventListener("click", () => editTask(li, text, date, priority));

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "🗑️";
        removeBtn.classList.add("remove-btn");
        removeBtn.addEventListener("click", () => {
            pushUndo({ type: "remove", task: { text, date, priority, done } });
            li.remove();
            removeTaskFromStorage(text);
            loadTasks();
        });

        li.appendChild(taskSpan);
        li.appendChild(dateSpan);
        li.appendChild(prioritySpan);
        li.appendChild(editBtn);
        li.appendChild(removeBtn);

        parent.appendChild(li);

        checkTaskExpiry(li, date);
    }

    function toggleTaskDone(li) {
        const text = li.querySelector("span").textContent;
        const oldDone = li.dataset.done === "true";
        const newDone = !oldDone;
        pushUndo({ type: "toggleDone", taskText: text, prevDone: oldDone });
        li.classList.toggle("done");
        li.dataset.done = newDone;
        updateTaskInStorage(text, null, null, null, newDone);
    }

    function editTask(li, oldText, oldDate, oldPriority) {
        const container = document.createElement("div");
        container.classList.add("edit-container");

        const inputField = document.createElement("input");
        inputField.type = "text";
        inputField.value = oldText;

        const newDateInput = document.createElement("input");
        newDateInput.type = "datetime-local";
        newDateInput.value = oldDate || "";

        const priorityInput = document.createElement("input");
        priorityInput.type = "number";
        priorityInput.min = "1";
        priorityInput.max = "5";
        priorityInput.value = oldPriority || 1;

        const saveBtn = document.createElement("button");
        saveBtn.textContent = "💾 Speichern";
        saveBtn.addEventListener("click", function () {
            const newText = inputField.value.trim();
            const newDate = newDateInput.value;
            const newPriority = parseInt(priorityInput.value);
            if (newText) {
                pushUndo({
                    type: "edit",
                    oldTask: { text: oldText, date: oldDate, priority: oldPriority },
                    newTask: { text: newText, date: newDate, priority: newPriority }
                });
                updateTaskInStorage(oldText, newText, newDate, newPriority);
                loadTasks();
            }
        });

        container.appendChild(inputField);
        container.appendChild(newDateInput);
        container.appendChild(priorityInput);
        container.appendChild(saveBtn);

        li.innerHTML = "";
        li.appendChild(container);
    }

    document.getElementById("suggest-subtasks").addEventListener("click", async () => {
        const taskInput = input.value.trim();
        const mainDate = dateInput.value;

        if (!taskInput) return alert("Bitte gib zuerst eine Aufgabe ein.");

        try {
            const tasks = JSON.parse(localStorage.getItem("tasks")) || [];

            // Hauptaufgabe hinzufügen, falls noch nicht vorhanden
            if (!tasks.some(task => task.text === taskInput && !task.parent)) {
                addTaskToStorage(taskInput, mainDate, 2);
                pushUndo({ type: "add", task: { text: taskInput, date: mainDate, priority: 2, done: false } });
            }

            // Subtasks vom Server holen
            const response = await fetch("/api/subtasks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ task: taskInput })
            });

            const data = await response.json();
            if (!data.subtasks || !Array.isArray(data.subtasks)) return alert("Keine Teilaufgaben erhalten.");

            const group = document.createElement("div");
            group.classList.add("collapsible-task");

            const header = document.createElement("div");
            header.classList.add("collapsible-header");
            header.textContent = taskInput;

            const subList = document.createElement("ul");
            subList.classList.add("collapsible-subtasks");

            data.subtasks.forEach(sub => {
                const text = sub.replace(/^[0-9]+\.\s*/, "").trim();

                // Prüfen ob Teilaufgabe schon existiert, um Duplikate zu vermeiden (optional)
                if (!tasks.some(task => task.text === text && task.parent === taskInput)) {
                    addTaskToStorage(text, mainDate, 3, false, taskInput);
                    pushUndo({ type: "add", task: { text, date: mainDate, priority: 3, done: false, parent: taskInput } });
                    addTaskToDOM(text, mainDate, 3, false, subList);
                }
            });

            header.addEventListener("click", () => {
                subList.style.display = subList.style.display === "block" ? "none" : "block";
                header.classList.toggle("expanded");
            });

            group.appendChild(header);
            group.appendChild(subList);
            todoList.appendChild(group);

            input.value = "";
            dateInput.value = "";

            loadTasks(); // neu laden, um Reihenfolge und Anzeige zu aktualisieren

        } catch (err) {
            console.error("Fehler bei Server-Anfrage:", err);
            alert("Fehler bei der Kommunikation mit dem Server.");
        }
    });

    function addTaskToStorage(text, date, priority, done = false, parent = null) {
        const tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        tasks.push({ text, date: date || new Date().toISOString(), priority, done, parent });
        localStorage.setItem("tasks", JSON.stringify(tasks));
    }

    function updateTaskInStorage(oldText, newText, newDate, newPriority, done) {
        let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        const index = tasks.findIndex(t => t.text === oldText);
        if (index !== -1) {
            tasks[index] = {
                ...tasks[index],
                text: newText || tasks[index].text,
                date: newDate !== null ? newDate : tasks[index].date,
                priority: newPriority !== null ? newPriority : tasks[index].priority,
                done: done !== undefined ? done : tasks[index].done
            };
            localStorage.setItem("tasks", JSON.stringify(tasks));
        }
    }

    function removeTaskFromStorage(text) {
        let tasks = JSON.parse(localStorage.getItem("tasks")) || [];
        tasks = tasks.filter(t => t.text !== text);
        localStorage.setItem("tasks", JSON.stringify(tasks));
    }

    function formatDate(dateString) {
        if (!dateString) return "Kein Datum";
        const options = { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" };
        return new Date(dateString).toLocaleString("de-DE", options);
    }

    function checkTaskExpiry(li, date) {
        if (!date) return;
        const taskTime = new Date(date);
        const now = new Date();
        if (taskTime < now) {
            li.classList.add("fade-out");
            if (!li.dataset.alerted) {
                const alertSound = document.getElementById("alertSound");
                if (alertSound) alertSound.play();
                showNotification(`Aufgabe \"${li.querySelector("span").textContent}\" ist abgelaufen!`);
                li.dataset.alerted = "true";
            }
        }
    }

    function showNotification(msg) {
        let box = document.getElementById("notification");
        if (!box) {
            box = document.createElement("div");
            box.id = "notification";
            box.className = "notification";
            document.body.appendChild(box);
        }
        box.textContent = msg;
        box.classList.add("show");
        setTimeout(() => box.classList.remove("show"), 4000);
    }

    addButton.addEventListener("click", function () {
        const task = input.value.trim();
        const date = dateInput.value;
        const priority = parseInt(prompt("Priorität (1 = Hoch, 5 = Niedrig):", "3")) || 3;
        if (task !== "") {
            pushUndo({ type: "add", task: { text: task, date, priority, done: false } });
            addTaskToStorage(task, date, priority);
            loadTasks();
            input.value = "";
            dateInput.value = "";
        }
    });

    undoButton.addEventListener("click", () => {
        const action = undoStack.pop();
        if (!action) return alert("Keine Aktion zum Rückgängig machen.");
        redoStack.push(action);

        switch (action.type) {
            case "add":
                removeTaskFromStorage(action.task.text);
                break;
            case "remove":
                addTaskToStorage(action.task.text, action.task.date, action.task.priority);
                updateTaskInStorage(action.task.text, null, null, null, action.task.done);
                break;
            case "edit":
                updateTaskInStorage(action.newTask.text, action.oldTask.text, action.oldTask.date, action.oldTask.priority);
                break;
            case "toggleDone":
                updateTaskInStorage(action.taskText, null, null, null, action.prevDone);
                break;
        }
        loadTasks();
    });

    redoButton.addEventListener("click", () => {
        const action = redoStack.pop();
        if (!action) return alert("Keine Aktion zum Wiederholen.");
        undoStack.push(action);

        switch (action.type) {
            case "add":
                addTaskToStorage(action.task.text, action.task.date, action.task.priority);
                break;
            case "remove":
                removeTaskFromStorage(action.task.text);
                break;
            case "edit":
                updateTaskInStorage(action.oldTask.text, action.newTask.text, action.newTask.date, action.newTask.priority);
                break;
            case "toggleDone":
                updateTaskInStorage(action.taskText, null, null, null, !action.prevDone);
                break;
        }
        loadTasks();
    });

    loadTasks();
    setInterval(() => {
        document.querySelectorAll("li").forEach(task => checkTaskExpiry(task, task.dataset.taskDate));
    }, 60000);
});