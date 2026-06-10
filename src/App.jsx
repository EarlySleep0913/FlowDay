import { useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  Download,
  Flame,
  HeartPulse,
  History,
  KeyRound,
  ListTodo,
  LogIn,
  LogOut,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Shield,
  Sparkles,
  Square,
  TimerReset,
  Trophy,
  Upload,
  UserCog,
  Users,
} from "lucide-react";

const STORAGE_KEY = "flowday-state-v1";
const todayKey = () => toDateKey(new Date());
const pad = (value) => String(value).padStart(2, "0");
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const COUNTUP_PROGRESS_SECONDS = 60 * 60;

function toDateKey(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function shiftDate(dateKey, delta) {
  const date = new Date(`${dateKey}T12:00:00`);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

function formatDate(dateKey) {
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("zh-CN", {
    month: "long",
    day: "numeric",
    weekday: "short",
  });
}

function formatSeconds(seconds) {
  const safe = Math.max(0, Math.floor(seconds || 0));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(secs)}`;
  return `${pad(minutes)}:${pad(secs)}`;
}

function formatMinutes(seconds) {
  if (seconds > 0 && seconds < 60) return "<1 分钟";
  const minutes = Math.round((seconds || 0) / 60);
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function getTimerElapsed(timer) {
  if (!timer.startedAt) return Math.max(0, Math.floor(timer.elapsed || 0));
  if (!timer.running || timer.paused || !timer.activeStartedAt) {
    return Math.max(0, Math.floor(timer.elapsed || 0));
  }
  const liveSeconds = Math.floor((Date.now() - timer.activeStartedAt) / 1000);
  return Math.max(0, Math.floor((timer.accumulatedSeconds || 0) + liveSeconds));
}

function getTimerRemaining(timer, elapsed = getTimerElapsed(timer)) {
  if (timer.mode !== "countdown") return 0;
  return Math.max(0, Math.floor((timer.plannedSeconds || 0) - elapsed));
}

function emptyState() {
  const date = todayKey();
  return {
    tasks: [
      {
        id: uid(),
        title: "整理今天最重要的三件事",
        date,
        done: false,
        tag: "规划",
        focusSeconds: 0,
        createdAt: new Date().toISOString(),
      },
      {
        id: uid(),
        title: "读书 20 分钟",
        date,
        done: false,
        tag: "成长",
        focusSeconds: 0,
        createdAt: new Date().toISOString(),
      },
    ],
    sessions: [],
    habits: [
      {
        id: uid(),
        name: "读书",
        icon: "📚",
        xp: 40,
        history: {},
      },
      {
        id: uid(),
        name: "运动",
        icon: "🏃",
        xp: 20,
        history: {},
      },
      {
        id: uid(),
        name: "早睡",
        icon: "🌙",
        xp: 0,
        history: {},
      },
    ],
    daily: {
      [date]: { mood: 4, energy: 3, note: "" },
    },
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? JSON.parse(saved) : emptyState();
  } catch {
    return emptyState();
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      "content-type": "application/json",
      ...(options.headers || {}),
    },
  });
  const contentType = response.headers.get("content-type") || "";
  const data = contentType.includes("application/json") ? await response.json() : null;
  if (!response.ok) {
    throw new Error(data?.error || "请求失败，请稍后重试。");
  }
  return data;
}

function getStreak(history, dateKey = todayKey()) {
  let cursor = dateKey;
  let streak = 0;
  while (history?.[cursor]) {
    streak += 1;
    cursor = shiftDate(cursor, -1);
  }
  return streak;
}

function getAdvice(mood, energy, completed, total) {
  const completion = total ? completed / total : 0;
  if (energy >= 4 && mood >= 3) {
    return {
      title: "适合深度工作",
      text: "把最费脑的任务放到前面，开一个 45-60 分钟的专注块。",
      tone: "focus",
    };
  }
  if (energy <= 2 && mood <= 2) {
    return {
      title: "适合恢复和收尾",
      text: "今天优先做低摩擦小事，留一点空间给休息。",
      tone: "rest",
    };
  }
  if (energy <= 2) {
    return {
      title: "适合轻任务",
      text: "把任务拆短，用 15-25 分钟的倒计时推进一点点。",
      tone: "light",
    };
  }
  if (completion >= 0.7) {
    return {
      title: "适合复盘",
      text: "完成度不错，可以记录一下今天真正花时间的地方。",
      tone: "review",
    };
  }
  return {
    title: "适合稳步推进",
    text: "选一个明确任务，先跑一轮 25 分钟专注。",
    tone: "steady",
  };
}

function App() {
  const [state, setState] = useState(loadState);
  const [activeView, setActiveView] = useState("today");
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [taskDraft, setTaskDraft] = useState("");
  const [taskTag, setTaskTag] = useState("工作");
  const [habitDraft, setHabitDraft] = useState("");
  const [timerMode, setTimerMode] = useState("countdown");
  const [timerSource, setTimerSource] = useState("preset");
  const [timerTaskId, setTimerTaskId] = useState("");
  const [presetTitle, setPresetTitle] = useState("专注写作");
  const [durationMinutes, setDurationMinutes] = useState(25);
  const [timer, setTimer] = useState({
    running: false,
    paused: false,
    elapsed: 0,
    remaining: 25 * 60,
    startedAt: null,
    activeStartedAt: null,
    accumulatedSeconds: 0,
    source: "preset",
    title: "专注写作",
    taskId: "",
    mode: "countdown",
    plannedSeconds: 25 * 60,
  });
  const savedTimerStartRef = useRef(null);
  const [rangeStart, setRangeStart] = useState(shiftDate(todayKey(), -6));
  const [rangeEnd, setRangeEnd] = useState(todayKey());
  const [queryTitle, setQueryTitle] = useState("");
  const [authLoading, setAuthLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState(null);
  const [loginUsername, setLoginUsername] = useState("earlysleep");
  const [loginPassword, setLoginPassword] = useState("");
  const [authMessage, setAuthMessage] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState("未登录时仅保存在本机");
  const [cloudReady, setCloudReady] = useState(false);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminForm, setAdminForm] = useState({
    username: "",
    displayName: "",
    password: "",
    role: "user",
  });
  const syncTimerRef = useRef(null);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    let alive = true;
    apiRequest("/api/auth/me")
      .then(async (data) => {
        if (!alive) return;
        setCurrentUser(data.user);
        if (data.user) {
          await loadCloudState("auto");
        }
      })
      .catch(() => {
        if (alive) {
          setSyncStatus("云同步需要部署到 Cloudflare Pages Functions 后使用");
        }
      })
      .finally(() => {
        if (alive) setAuthLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    if (currentUser?.role === "admin") {
      refreshAdminUsers();
    } else {
      setAdminUsers([]);
    }
  }, [currentUser?.id, currentUser?.role]);

  useEffect(() => {
    if (!currentUser || !cloudReady) return undefined;
    clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      uploadCloudState("auto");
    }, 900);
    return () => clearTimeout(syncTimerRef.current);
  }, [state, currentUser?.id, cloudReady]);

  useEffect(() => {
    if (!timer.running || timer.paused) return undefined;
    const interval = setInterval(() => {
      setTimer((current) => {
        const elapsed = getTimerElapsed(current);
        const remaining = getTimerRemaining(current, elapsed);
        if (current.mode === "countdown" && remaining <= 0) {
          return {
            ...current,
            elapsed: current.plannedSeconds,
            remaining: 0,
            running: false,
            paused: false,
            activeStartedAt: null,
            accumulatedSeconds: current.plannedSeconds,
          };
        }
        return { ...current, elapsed, remaining };
      });
    }, 250);
    return () => clearInterval(interval);
  }, [timer.running, timer.paused]);

  useEffect(() => {
    if (!timer.running && timer.startedAt && timer.elapsed > 0 && timer.remaining === 0) {
      finishTimer();
    }
  }, [timer.running, timer.startedAt, timer.elapsed, timer.remaining]);

  const tasksForDate = useMemo(
    () => state.tasks.filter((task) => task.date === selectedDate),
    [state.tasks, selectedDate]
  );

  const todayTasks = useMemo(
    () => state.tasks.filter((task) => task.date === todayKey()),
    [state.tasks]
  );

  const daily = state.daily[selectedDate] || { mood: 3, energy: 3, note: "" };
  const completedCount = tasksForDate.filter((task) => task.done).length;
  const advice = getAdvice(daily.mood, daily.energy, completedCount, tasksForDate.length);
  const totalFocusToday = state.sessions
    .filter((session) => session.date === todayKey())
    .reduce((sum, session) => sum + session.durationSeconds, 0);

  const stats = useMemo(
    () => buildStats(state.sessions, rangeStart, rangeEnd),
    [state.sessions, rangeStart, rangeEnd]
  );

  const searchableTitles = useMemo(() => {
    const titles = new Set();
    state.tasks.forEach((task) => titles.add(task.title));
    state.sessions.forEach((session) => titles.add(session.title));
    return [...titles].sort((a, b) => a.localeCompare(b, "zh-CN"));
  }, [state.tasks, state.sessions]);

  const titleTotal = useMemo(() => {
    const target = queryTitle.trim();
    if (!target) return 0;
    return state.sessions
      .filter((session) => session.title === target)
      .reduce((sum, session) => sum + session.durationSeconds, 0);
  }, [state.sessions, queryTitle]);

  async function handleLogin(event) {
    event.preventDefault();
    setAuthMessage("");
    setSyncing(true);
    try {
      const data = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({ username: loginUsername, password: loginPassword }),
      });
      setCurrentUser(data.user);
      setLoginPassword("");
      await loadCloudState("login");
      setAuthMessage("登录成功，云同步已开启。");
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setSyncing(false);
      setAuthLoading(false);
    }
  }

  async function handleLogout() {
    setSyncing(true);
    try {
      await uploadCloudState("manual");
      await apiRequest("/api/auth/logout", { method: "POST", body: "{}" });
      setCurrentUser(null);
      setCloudReady(false);
      setAdminUsers([]);
      setSyncStatus("已退出，之后的数据仅保存在本机");
      setAuthMessage("");
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function loadCloudState(reason = "manual") {
    setSyncing(true);
    try {
      const data = await apiRequest("/api/sync");
      if (data.state) {
        setState(data.state);
        setSyncStatus(`已从云端同步：${new Date().toLocaleTimeString("zh-CN")}`);
      } else {
        await apiRequest("/api/sync", {
          method: "PUT",
          body: JSON.stringify({ state }),
        });
        setSyncStatus("云端暂无数据，已上传当前本地数据");
      }
      setCloudReady(true);
      if (reason === "manual") setAuthMessage("已从云端拉取数据。");
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function uploadCloudState(reason = "manual") {
    if (!currentUser) return;
    setSyncing(true);
    try {
      await apiRequest("/api/sync", {
        method: "PUT",
        body: JSON.stringify({ state }),
      });
      setSyncStatus(`已保存到云端：${new Date().toLocaleTimeString("zh-CN")}`);
      if (reason === "manual") setAuthMessage("当前数据已上传到云端。");
    } catch (error) {
      setAuthMessage(error.message);
    } finally {
      setSyncing(false);
    }
  }

  async function refreshAdminUsers() {
    try {
      const data = await apiRequest("/api/admin/users");
      setAdminUsers(data.users || []);
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  async function createAdminUser(event) {
    event.preventDefault();
    setAuthMessage("");
    try {
      await apiRequest("/api/admin/users", {
        method: "POST",
        body: JSON.stringify(adminForm),
      });
      setAdminForm({ username: "", displayName: "", password: "", role: "user" });
      await refreshAdminUsers();
      setAuthMessage("账号已创建。");
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  async function updateAdminUser(userId, patch) {
    setAuthMessage("");
    try {
      await apiRequest(`/api/admin/users/${userId}`, {
        method: "PATCH",
        body: JSON.stringify(patch),
      });
      await refreshAdminUsers();
      setAuthMessage("账号已更新。");
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  async function disableAdminUser(userId) {
    setAuthMessage("");
    try {
      await apiRequest(`/api/admin/users/${userId}`, {
        method: "DELETE",
      });
      await refreshAdminUsers();
      setAuthMessage("账号已停用。");
    } catch (error) {
      setAuthMessage(error.message);
    }
  }

  function patchDaily(date, patch) {
    setState((current) => ({
      ...current,
      daily: {
        ...current.daily,
        [date]: { mood: 3, energy: 3, note: "", ...current.daily[date], ...patch },
      },
    }));
  }

  function addTask(event) {
    event.preventDefault();
    const title = taskDraft.trim();
    if (!title) return;
    setState((current) => ({
      ...current,
      tasks: [
        {
          id: uid(),
          title,
          tag: taskTag,
          date: selectedDate,
          done: false,
          focusSeconds: 0,
          createdAt: new Date().toISOString(),
        },
        ...current.tasks,
      ],
    }));
    setTaskDraft("");
  }

  function toggleTask(taskId) {
    setState((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task
      ),
    }));
  }

  function removeTask(taskId) {
    setState((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
  }

  function addHabit(event) {
    event.preventDefault();
    const name = habitDraft.trim();
    if (!name) return;
    setState((current) => ({
      ...current,
      habits: [
        ...current.habits,
        { id: uid(), name, icon: "✨", xp: 0, history: {} },
      ],
    }));
    setHabitDraft("");
  }

  function toggleHabit(habitId) {
    setState((current) => ({
      ...current,
      habits: current.habits.map((habit) => {
        if (habit.id !== habitId) return habit;
        const checked = Boolean(habit.history[selectedDate]);
        const history = { ...habit.history, [selectedDate]: !checked };
        if (checked) delete history[selectedDate];
        return {
          ...habit,
          history,
          xp: Math.max(0, habit.xp + (checked ? -10 : 10)),
        };
      }),
    }));
  }

  function startTimer() {
    const task = state.tasks.find((item) => item.id === timerTaskId);
    const usingTask = timerSource === "todo" && task;
    const title = usingTask ? task.title : presetTitle.trim() || "自由专注";
    const plannedSeconds =
      timerMode === "countdown"
        ? Math.max(1, Number(durationMinutes) || 1) * 60
        : COUNTUP_PROGRESS_SECONDS;
    const startedAt = new Date().toISOString();
    savedTimerStartRef.current = null;
    setTimer({
      running: true,
      paused: false,
      elapsed: 0,
      remaining: timerMode === "countdown" ? plannedSeconds : 0,
      startedAt,
      activeStartedAt: Date.now(),
      accumulatedSeconds: 0,
      source: usingTask ? "todo" : "preset",
      title,
      taskId: usingTask ? task.id : "",
      mode: timerMode,
      plannedSeconds,
    });
  }

  function finishTimer() {
    const durationSeconds = getTimerElapsed(timer);
    if (!timer.startedAt || durationSeconds <= 0) return;
    if (savedTimerStartRef.current === timer.startedAt) return;
    savedTimerStartRef.current = timer.startedAt;

    const session = {
      id: uid(),
      taskId: timer.taskId,
      title: timer.title,
      source: timer.source,
      mode: timer.mode,
      date: todayKey(),
      startedAt: timer.startedAt,
      endedAt: new Date().toISOString(),
      durationSeconds,
    };

    setState((snapshot) => ({
      ...snapshot,
      sessions: [session, ...snapshot.sessions],
      tasks: snapshot.tasks.map((task) =>
        task.id === timer.taskId
          ? { ...task, focusSeconds: (task.focusSeconds || 0) + durationSeconds }
          : task
      ),
    }));

    setTimer((current) => ({
      running: false,
      paused: false,
      elapsed: 0,
      remaining: timerMode === "countdown" ? current.plannedSeconds : 0,
      startedAt: null,
      activeStartedAt: null,
      accumulatedSeconds: 0,
      source: timerSource,
      title: presetTitle,
      taskId: timerTaskId,
      mode: timerMode,
      plannedSeconds: current.plannedSeconds,
    }));
  }

  function resetTimer() {
    const plannedSeconds =
      timerMode === "countdown"
        ? Math.max(1, Number(durationMinutes) || 1) * 60
        : COUNTUP_PROGRESS_SECONDS;
    savedTimerStartRef.current = null;
    setTimer({
      running: false,
      paused: false,
      elapsed: 0,
      remaining: timerMode === "countdown" ? plannedSeconds : 0,
      startedAt: null,
      activeStartedAt: null,
      accumulatedSeconds: 0,
      source: timerSource,
      title: presetTitle,
      taskId: timerTaskId,
      mode: timerMode,
      plannedSeconds,
    });
  }

  function changeTimerMode(mode) {
    setTimerMode(mode);
    if (timer.running) return;
    const plannedSeconds =
      mode === "countdown"
        ? Math.max(1, Number(durationMinutes) || 1) * 60
        : COUNTUP_PROGRESS_SECONDS;
    setTimer((current) => ({
      ...current,
      mode,
      plannedSeconds,
      elapsed: 0,
      remaining: mode === "countdown" ? plannedSeconds : 0,
      activeStartedAt: null,
      accumulatedSeconds: 0,
    }));
  }

  function changeDurationMinutes(value) {
    setDurationMinutes(value);
    if (timer.running || timerMode !== "countdown") return;
    const plannedSeconds = Math.max(1, Number(value) || 1) * 60;
    setTimer((current) => ({
      ...current,
      plannedSeconds,
      remaining: plannedSeconds,
    }));
  }

  function toggleTimerPause() {
    setTimer((current) => {
      if (!current.running) return current;
      const elapsed = getTimerElapsed(current);
      if (current.paused) {
        return {
          ...current,
          paused: false,
          activeStartedAt: Date.now(),
          accumulatedSeconds: elapsed,
        };
      }
      return {
        ...current,
        paused: true,
        elapsed,
        remaining: getTimerRemaining(current, elapsed),
        activeStartedAt: null,
        accumulatedSeconds: elapsed,
      };
    });
  }

  function handleSpotlightMove(event) {
    const target = event.target.closest?.(".glass");
    if (!target || !event.currentTarget.contains(target)) return;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
  }

  return (
    <main className="app-shell" onPointerMove={handleSpotlightMove}>
      <ClickSpark />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />

      <header className="topbar glass">
        <div>
          <p className="eyebrow">FlowDay</p>
          <h1>任务、习惯和专注时间都在一个地方</h1>
        </div>
        <div className="date-pill">
          <CalendarDays size={18} />
          <span>{formatDate(todayKey())}</span>
        </div>
      </header>

      <nav className="view-tabs glass" aria-label="主要视图">
        <TabButton icon={ListTodo} label="今日" active={activeView === "today"} onClick={() => setActiveView("today")} />
        <TabButton icon={Clock3} label="番茄钟" active={activeView === "timer"} onClick={() => setActiveView("timer")} />
        <TabButton icon={BarChart3} label="统计" active={activeView === "stats"} onClick={() => setActiveView("stats")} />
        <TabButton icon={History} label="历史" active={activeView === "history"} onClick={() => setActiveView("history")} />
        <TabButton icon={UserCog} label="账号" active={activeView === "account"} onClick={() => setActiveView("account")} />
      </nav>

      {activeView === "today" && (
        <section className="dashboard-grid">
          <section className="panel glass mood-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">状态看板</p>
                <h2>{formatDate(selectedDate)}</h2>
              </div>
              <div className={`advice-badge ${advice.tone}`}>
                <Sparkles size={16} />
                <span>{advice.title}</span>
              </div>
            </div>

            <div className="date-controls">
              <button className="icon-button" onClick={() => setSelectedDate(shiftDate(selectedDate, -1))} aria-label="前一天">
                <ChevronLeft size={18} />
              </button>
              <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
              <button className="icon-button" onClick={() => setSelectedDate(shiftDate(selectedDate, 1))} aria-label="后一天">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="sliders">
              <label>
                <span>心情 {daily.mood}/5</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={daily.mood}
                  onChange={(event) => patchDaily(selectedDate, { mood: Number(event.target.value) })}
                />
              </label>
              <label>
                <span>精力 {daily.energy}/5</span>
                <input
                  type="range"
                  min="1"
                  max="5"
                  value={daily.energy}
                  onChange={(event) => patchDaily(selectedDate, { energy: Number(event.target.value) })}
                />
              </label>
            </div>

            <p className="advice-copy">{advice.text}</p>
            <textarea
              rows="3"
              placeholder="给今天留一句简短备注"
              value={daily.note}
              onChange={(event) => patchDaily(selectedDate, { note: event.target.value })}
            />

            <div className="metric-row">
              <Metric icon={Check} label="完成" value={`${completedCount}/${tasksForDate.length}`} />
              <Metric icon={TimerReset} label="今日专注" value={formatMinutes(totalFocusToday)} />
              <Metric icon={HeartPulse} label="状态" value={`${daily.mood + daily.energy}/10`} />
            </div>
          </section>

          <section className="panel glass todo-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">TODO</p>
                <h2>按日期归档的任务</h2>
              </div>
            </div>
            <form className="task-form" onSubmit={addTask}>
              <input
                value={taskDraft}
                onChange={(event) => setTaskDraft(event.target.value)}
                placeholder="添加一个要做的事"
              />
              <select value={taskTag} onChange={(event) => setTaskTag(event.target.value)}>
                <option>工作</option>
                <option>学习</option>
                <option>生活</option>
                <option>健康</option>
                <option>规划</option>
              </select>
              <button className="primary-button" type="submit">
                <Plus size={18} />
                添加
              </button>
            </form>

            <div className="task-list">
              {tasksForDate.length === 0 ? (
                <EmptyState text="这一天还没有任务。" />
              ) : (
                tasksForDate.map((task) => (
                  <article className={`task-item ${task.done ? "done" : ""}`} key={task.id}>
                    <button className="check-button" onClick={() => toggleTask(task.id)} aria-label="切换完成状态">
                      {task.done && <Check size={16} />}
                    </button>
                    <div className="task-main">
                      <h3>{task.title}</h3>
                      <div className="task-meta">
                        <span>{task.tag}</span>
                        <span>已专注 {formatMinutes(task.focusSeconds)}</span>
                      </div>
                    </div>
                    <button className="ghost-button compact" onClick={() => {
                      setActiveView("timer");
                      setTimerSource("todo");
                      setTimerTaskId(task.id);
                    }}>
                      <Clock3 size={16} />
                      计时
                    </button>
                    <button className="text-button" onClick={() => removeTask(task.id)}>删除</button>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="panel glass habits-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">习惯养成</p>
                <h2>连续打卡与等级</h2>
              </div>
              <Trophy size={24} className="gold-icon" />
            </div>
            <form className="habit-form" onSubmit={addHabit}>
              <input value={habitDraft} onChange={(event) => setHabitDraft(event.target.value)} placeholder="添加习惯" />
              <button className="icon-button" aria-label="添加习惯" type="submit">
                <Plus size={18} />
              </button>
            </form>
            <div className="habit-list">
              {state.habits.map((habit) => {
                const checked = Boolean(habit.history[selectedDate]);
                const streak = getStreak(habit.history, selectedDate);
                const level = Math.floor(habit.xp / 100) + 1;
                return (
                  <button className={`habit-item ${checked ? "checked" : ""}`} key={habit.id} onClick={() => toggleHabit(habit.id)}>
                    <span className="habit-icon">{habit.icon}</span>
                    <span className="habit-name">{habit.name}</span>
                    <span className="habit-stats">
                      <Flame size={14} />
                      {streak} 天 · Lv.{level}
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </section>
      )}

      {activeView === "timer" && (
        <section className="timer-layout">
          <section className="panel glass timer-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">FOCUS TIMER</p>
                <h2>{timer.running ? timer.title : "设置一次专注"}</h2>
              </div>
              <div className="mode-switch">
                <button className={timerMode === "countdown" ? "active" : ""} onClick={() => changeTimerMode("countdown")}>倒计时</button>
                <button className={timerMode === "countup" ? "active" : ""} onClick={() => changeTimerMode("countup")}>正计时</button>
              </div>
            </div>

            <div className="timer-face">
              <div className="timer-ring" style={{ "--progress": timerProgress(timer) }}>
                <span>{timer.mode === "countdown" ? formatSeconds(timer.remaining) : formatSeconds(timer.elapsed)}</span>
              </div>
              <p>{timer.running ? `已进行 ${formatSeconds(timer.elapsed)}` : "选择任务或预设事件后开始"}</p>
            </div>

            <div className="timer-actions">
              {!timer.running ? (
                <button className="primary-button large" onClick={startTimer}>
                  <Play size={20} />
                  开始
                </button>
              ) : (
                <>
                  <button className="primary-button large" onClick={toggleTimerPause}>
                    {timer.paused ? <Play size={20} /> : <Pause size={20} />}
                    {timer.paused ? "继续" : "暂停"}
                  </button>
                  <button className="danger-button large" onClick={finishTimer}>
                    <Square size={18} />
                    结束并保存
                  </button>
                </>
              )}
              <button className="ghost-button large" onClick={resetTimer}>
                <RotateCcw size={18} />
                重置
              </button>
            </div>
          </section>

          <aside className="panel glass timer-settings">
            <p className="eyebrow">计时对象</p>
            <div className="segmented">
              <button className={timerSource === "preset" ? "active" : ""} onClick={() => setTimerSource("preset")}>预设事件</button>
              <button className={timerSource === "todo" ? "active" : ""} onClick={() => setTimerSource("todo")}>读取 TODO</button>
            </div>

            {timerSource === "preset" ? (
              <label className="field">
                <span>事件名称</span>
                <input value={presetTitle} onChange={(event) => setPresetTitle(event.target.value)} />
              </label>
            ) : (
              <label className="field">
                <span>选择今日 TODO</span>
                <select value={timerTaskId} onChange={(event) => setTimerTaskId(event.target.value)}>
                  <option value="">请选择任务</option>
                  {todayTasks.map((task) => (
                    <option value={task.id} key={task.id}>{task.title}</option>
                  ))}
                </select>
              </label>
            )}

            {timerMode === "countdown" && (
              <label className="field">
                <span>倒计时时长</span>
                <input
                  type="number"
                  min="1"
                  max="180"
                  value={durationMinutes}
                  onChange={(event) => changeDurationMinutes(event.target.value)}
                />
              </label>
            )}

            {timerMode === "countup" && (
              <div className="mode-note">
                <Clock3 size={18} />
                <span>正计时会从 00:00 开始，结束时保存实际经过时间。</span>
              </div>
            )}

            <div className="recent-list">
              <p className="eyebrow">最近专注</p>
              {state.sessions.slice(0, 5).length === 0 ? (
                <EmptyState text="还没有专注记录。" />
              ) : (
                state.sessions.slice(0, 5).map((session) => (
                  <div className="recent-item" key={session.id}>
                    <span>{session.title}</span>
                    <strong>{formatMinutes(session.durationSeconds)}</strong>
                  </div>
                ))
              )}
            </div>
          </aside>
        </section>
      )}

      {activeView === "stats" && (
        <section className="stats-layout">
          <section className="panel glass wide-panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">统计</p>
                <h2>指定日期范围内的专注分布</h2>
              </div>
              <div className="range-fields">
                <input type="date" value={rangeStart} onChange={(event) => setRangeStart(event.target.value)} />
                <span>至</span>
                <input type="date" value={rangeEnd} onChange={(event) => setRangeEnd(event.target.value)} />
              </div>
            </div>
            <BarChart data={stats.byTitle} />
          </section>

          <section className="panel glass">
            <p className="eyebrow">今日构成</p>
            <DonutChart data={buildStats(state.sessions, todayKey(), todayKey()).byTitle} />
          </section>

          <section className="panel glass">
            <p className="eyebrow">单项累计</p>
            <label className="field">
              <span>选择事项</span>
              <input
                list="focus-titles"
                value={queryTitle}
                onChange={(event) => setQueryTitle(event.target.value)}
                placeholder="输入或选择事项"
              />
              <datalist id="focus-titles">
                {searchableTitles.map((title) => (
                  <option value={title} key={title} />
                ))}
              </datalist>
            </label>
            <div className="big-number">{formatMinutes(titleTotal)}</div>
            <p className="muted">统计所有历史中这个事项的总专注时间。</p>
          </section>

          <section className="panel glass wide-panel">
            <p className="eyebrow">每日趋势</p>
            <Timeline data={stats.byDate} />
          </section>
        </section>
      )}

      {activeView === "history" && (
        <section className="panel glass history-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">历史</p>
              <h2>之前的任务和专注记录</h2>
            </div>
          </div>
          <HistoryList tasks={state.tasks} sessions={state.sessions} />
        </section>
      )}

      {activeView === "account" && (
        <AccountPanel
          authLoading={authLoading}
          currentUser={currentUser}
          loginUsername={loginUsername}
          loginPassword={loginPassword}
          setLoginUsername={setLoginUsername}
          setLoginPassword={setLoginPassword}
          handleLogin={handleLogin}
          handleLogout={handleLogout}
          authMessage={authMessage}
          syncing={syncing}
          syncStatus={syncStatus}
          loadCloudState={() => loadCloudState("manual")}
          uploadCloudState={() => uploadCloudState("manual")}
          adminUsers={adminUsers}
          adminForm={adminForm}
          setAdminForm={setAdminForm}
          createAdminUser={createAdminUser}
          updateAdminUser={updateAdminUser}
          disableAdminUser={disableAdminUser}
          refreshAdminUsers={refreshAdminUsers}
        />
      )}
    </main>
  );
}

function TabButton({ icon: Icon, label, active, onClick }) {
  return (
    <button className={active ? "active" : ""} onClick={onClick}>
      <Icon size={18} />
      <span>{label}</span>
    </button>
  );
}

function Metric({ icon: Icon, label, value }) {
  return (
    <div className="metric">
      <Icon size={18} />
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function EmptyState({ text }) {
  return <p className="empty-state">{text}</p>;
}

function ClickSpark() {
  const [bursts, setBursts] = useState([]);

  useEffect(() => {
    function handlePointerDown(event) {
      const id = uid();
      setBursts((current) => [
        ...current.slice(-7),
        { id, x: event.clientX, y: event.clientY },
      ]);
      window.setTimeout(() => {
        setBursts((current) => current.filter((burst) => burst.id !== id));
      }, 720);
    }

    window.addEventListener("pointerdown", handlePointerDown);
    return () => window.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div className="click-spark-layer" aria-hidden="true">
      {bursts.map((burst) => (
        <span
          className="click-spark"
          key={burst.id}
          style={{ "--spark-x": `${burst.x}px`, "--spark-y": `${burst.y}px` }}
        >
          {Array.from({ length: 8 }).map((_, index) => (
            <i key={index} style={{ "--spark-angle": `${index * 45}deg` }} />
          ))}
        </span>
      ))}
    </div>
  );
}

function timerProgress(timer) {
  if (!timer.running && timer.elapsed === 0) return "0%";
  if (timer.mode === "countup") return `${Math.min(100, (timer.elapsed / 3600) * 100)}%`;
  return `${Math.min(100, (timer.elapsed / timer.plannedSeconds) * 100)}%`;
}

function buildStats(sessions, start, end) {
  const byTitleMap = new Map();
  const byDateMap = new Map();
  sessions
    .filter((session) => session.date >= start && session.date <= end)
    .forEach((session) => {
      byTitleMap.set(session.title, (byTitleMap.get(session.title) || 0) + session.durationSeconds);
      byDateMap.set(session.date, (byDateMap.get(session.date) || 0) + session.durationSeconds);
    });
  return {
    byTitle: [...byTitleMap.entries()]
      .map(([label, seconds]) => ({ label, seconds }))
      .sort((a, b) => b.seconds - a.seconds),
    byDate: fillDateRange(start, end, byDateMap),
  };
}

function fillDateRange(start, end, map) {
  const result = [];
  let cursor = start;
  let guard = 0;
  while (cursor <= end && guard < 370) {
    result.push({ label: cursor.slice(5), seconds: map.get(cursor) || 0 });
    cursor = shiftDate(cursor, 1);
    guard += 1;
  }
  return result;
}

function BarChart({ data }) {
  const max = Math.max(1, ...data.map((item) => item.seconds));
  if (data.length === 0) return <EmptyState text="这个范围还没有专注记录。" />;
  return (
    <div className="bar-chart">
      {data.slice(0, 8).map((item) => (
        <div className="bar-row" key={item.label}>
          <span>{item.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(item.seconds / max) * 100}%` }} />
          </div>
          <strong>{formatMinutes(item.seconds)}</strong>
        </div>
      ))}
    </div>
  );
}

function DonutChart({ data }) {
  const total = data.reduce((sum, item) => sum + item.seconds, 0);
  if (!total) return <EmptyState text="今天还没有记录。" />;
  let offset = 25;
  return (
    <div className="donut-wrap">
      <svg viewBox="0 0 42 42" className="donut">
        <circle cx="21" cy="21" r="15.915" />
        {data.slice(0, 5).map((item, index) => {
          const value = (item.seconds / total) * 100;
          const segment = (
            <circle
              key={item.label}
              cx="21"
              cy="21"
              r="15.915"
              strokeDasharray={`${value} ${100 - value}`}
              strokeDashoffset={offset}
              className={`donut-segment segment-${index}`}
            />
          );
          offset -= value;
          return segment;
        })}
      </svg>
      <div className="donut-center">
        <strong>{formatMinutes(total)}</strong>
        <span>今天</span>
      </div>
      <div className="legend">
        {data.slice(0, 5).map((item, index) => (
          <span key={item.label}>
            <i className={`legend-dot segment-${index}`} />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}

function Timeline({ data }) {
  const max = Math.max(1, ...data.map((item) => item.seconds));
  return (
    <div className="timeline">
      {data.map((item) => (
        <div className="day-column" key={item.label}>
          <div className="day-bar" style={{ height: `${Math.max(4, (item.seconds / max) * 100)}%` }} />
          <span>{item.label}</span>
        </div>
      ))}
    </div>
  );
}

function HistoryList({ tasks, sessions }) {
  const dates = [...new Set([...tasks.map((task) => task.date), ...sessions.map((session) => session.date)])].sort((a, b) => b.localeCompare(a));
  if (dates.length === 0) return <EmptyState text="还没有历史数据。" />;
  return (
    <div className="history-list">
      {dates.map((date) => {
        const dayTasks = tasks.filter((task) => task.date === date);
        const daySessions = sessions.filter((session) => session.date === date);
        return (
          <article className="history-day" key={date}>
            <div className="history-date">
              <strong>{formatDate(date)}</strong>
              <span>{dayTasks.filter((task) => task.done).length}/{dayTasks.length} 完成</span>
            </div>
            <div className="history-content">
              {dayTasks.map((task) => (
                <span className={task.done ? "history-chip done" : "history-chip"} key={task.id}>
                  {task.title} · {formatMinutes(task.focusSeconds)}
                </span>
              ))}
              {daySessions.map((session) => (
                <span className="history-chip focus" key={session.id}>
                  {session.title} · {formatMinutes(session.durationSeconds)}
                </span>
              ))}
            </div>
          </article>
        );
      })}
    </div>
  );
}

function AccountPanel({
  authLoading,
  currentUser,
  loginUsername,
  loginPassword,
  setLoginUsername,
  setLoginPassword,
  handleLogin,
  handleLogout,
  authMessage,
  syncing,
  syncStatus,
  loadCloudState,
  uploadCloudState,
  adminUsers,
  adminForm,
  setAdminForm,
  createAdminUser,
  updateAdminUser,
  disableAdminUser,
  refreshAdminUsers,
}) {
  return (
    <section className="account-layout">
      <section className="panel glass account-card">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">账号与云同步</p>
            <h2>{currentUser ? `你好，${currentUser.displayName}` : "登录后开启云同步"}</h2>
          </div>
          <Cloud className="cloud-icon" size={28} />
        </div>

        {authLoading ? (
          <EmptyState text="正在检查登录状态。" />
        ) : currentUser ? (
          <>
            <div className="account-summary">
              <Metric icon={Shield} label="角色" value={currentUser.role === "admin" ? "管理员" : "用户"} />
              <Metric icon={Cloud} label="同步状态" value={syncing ? "同步中" : "已就绪"} />
              <Metric icon={Save} label="本地缓存" value="已开启" />
            </div>

            <p className="sync-status">{syncStatus}</p>
            <div className="account-actions">
              <button className="primary-button" onClick={uploadCloudState} disabled={syncing}>
                <Upload size={18} />
                上传当前数据
              </button>
              <button className="ghost-button" onClick={loadCloudState} disabled={syncing}>
                <Download size={18} />
                拉取云端数据
              </button>
              <button className="ghost-button" onClick={handleLogout} disabled={syncing}>
                <LogOut size={18} />
                退出
              </button>
            </div>
          </>
        ) : (
          <form className="login-form" onSubmit={handleLogin}>
            <label className="field">
              <span>用户名</span>
              <input
                value={loginUsername}
                onChange={(event) => setLoginUsername(event.target.value)}
                autoComplete="username"
              />
            </label>
            <label className="field">
              <span>密码</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
                autoComplete="current-password"
              />
            </label>
            <button className="primary-button large" type="submit" disabled={syncing}>
              <LogIn size={20} />
              登录
            </button>
          </form>
        )}

        {authMessage && <p className="account-message">{authMessage}</p>}
      </section>

      {currentUser?.role === "admin" && (
        <section className="panel glass admin-card">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">管理员</p>
              <h2>账号管理</h2>
            </div>
            <button className="icon-button" onClick={refreshAdminUsers} aria-label="刷新账号列表">
              <RefreshCw size={18} />
            </button>
          </div>

          <form className="admin-create-form" onSubmit={createAdminUser}>
            <input
              value={adminForm.username}
              onChange={(event) => setAdminForm((form) => ({ ...form, username: event.target.value }))}
              placeholder="用户名"
            />
            <input
              value={adminForm.displayName}
              onChange={(event) => setAdminForm((form) => ({ ...form, displayName: event.target.value }))}
              placeholder="显示名称"
            />
            <input
              type="password"
              value={adminForm.password}
              onChange={(event) => setAdminForm((form) => ({ ...form, password: event.target.value }))}
              placeholder="初始密码"
            />
            <select
              value={adminForm.role}
              onChange={(event) => setAdminForm((form) => ({ ...form, role: event.target.value }))}
            >
              <option value="user">普通用户</option>
              <option value="admin">管理员</option>
            </select>
            <button className="primary-button" type="submit">
              <Plus size={18} />
              创建账号
            </button>
          </form>

          <div className="admin-user-list">
            {adminUsers.length === 0 ? (
              <EmptyState text="暂无账号或正在加载。" />
            ) : (
              adminUsers.map((user) => (
                <AdminUserRow
                  key={user.id}
                  user={user}
                  currentUser={currentUser}
                  updateAdminUser={updateAdminUser}
                  disableAdminUser={disableAdminUser}
                />
              ))
            )}
          </div>
        </section>
      )}
    </section>
  );
}

function AdminUserRow({ user, currentUser, updateAdminUser, disableAdminUser }) {
  const [displayName, setDisplayName] = useState(user.displayName);
  const [role, setRole] = useState(user.role);
  const [password, setPassword] = useState("");
  const isSelf = user.id === currentUser.id;

  useEffect(() => {
    setDisplayName(user.displayName);
    setRole(user.role);
    setPassword("");
  }, [user.id, user.displayName, user.role]);

  return (
    <article className={`admin-user-row ${user.disabled ? "disabled" : ""}`}>
      <div className="admin-user-title">
        <Users size={18} />
        <div>
          <strong>{user.username}</strong>
          <span>{user.disabled ? "已停用" : user.role === "admin" ? "管理员" : "普通用户"}</span>
        </div>
      </div>

      <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} />
      <select value={role} onChange={(event) => setRole(event.target.value)} disabled={isSelf}>
        <option value="user">普通用户</option>
        <option value="admin">管理员</option>
      </select>
      <button
        className="ghost-button"
        onClick={() => updateAdminUser(user.id, { displayName, role })}
      >
        <Save size={16} />
        保存
      </button>

      <input
        type="password"
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="新密码"
      />
      <button
        className="ghost-button"
        onClick={() => {
          updateAdminUser(user.id, { password });
          setPassword("");
        }}
        disabled={!password}
      >
        <KeyRound size={16} />
        重置密码
      </button>
      <button
        className="danger-button"
        onClick={() => disableAdminUser(user.id)}
        disabled={isSelf || user.disabled}
      >
        停用
      </button>
    </article>
  );
}

export default App;
