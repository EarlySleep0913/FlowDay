import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Cloud,
  Coins,
  Crown,
  Download,
  Flame,
  Gamepad2,
  Gem,
  HeartPulse,
  History,
  KeyRound,
  ListTodo,
  LogIn,
  LogOut,
  LockKeyhole,
  Pause,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Save,
  Settings,
  Shield,
  Shirt,
  ShoppingBag,
  SlidersHorizontal,
  Sparkles,
  Square,
  Star,
  Target,
  TimerReset,
  Trophy,
  Upload,
  UserCog,
  Users,
  Zap,
} from "lucide-react";
import { DEFAULT_SKIN_ID, getSkin, rarityMeta, skins } from "./skins";

const STORAGE_KEY = "flowday-state-v1";
const todayKey = () => toDateKey(new Date());
const pad = (value) => String(value).padStart(2, "0");
const uid = () => crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
const COUNTUP_PROGRESS_SECONDS = 60 * 60;
const TASK_COIN_REWARD = 20;
const HABIT_COIN_REWARD = 12;
const FOCUS_COIN_UNIT_SECONDS = 5 * 60;
const FOCUS_COIN_REWARD = 8;
const AVATAR_EFFECT_TYPES = ["standee", "pulse", "hop", "sparkle", "shake"];
const DEFAULT_APPEARANCE = {
  backgroundId: "theme",
  backgroundBlur: 8,
};
const BACKGROUNDS = [
  { id: "theme", name: "主题", image: null },
  { id: "background-01", name: "背景 01", image: "/background/background-01.png" },
  { id: "background-02", name: "背景 02", image: "/background/background-02.png" },
  { id: "background-03", name: "背景 03", image: "/background/background-03.png" },
  { id: "background-04", name: "背景 04", image: "/background/background-04.png" },
  { id: "background-05", name: "背景 05", image: "/background/background-05.png" },
  { id: "background-06", name: "背景 06", image: "/background/background-06.png" },
];

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

function getFocusCoinReward(seconds) {
  if (seconds < 60) return 0;
  return Math.max(2, Math.floor(seconds / FOCUS_COIN_UNIT_SECONDS) * FOCUS_COIN_REWARD);
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
    wallet: {
      coins: 120,
      lifetimeCoins: 120,
    },
    inventory: {
      ownedSkinIds: [DEFAULT_SKIN_ID],
      equippedSkinId: DEFAULT_SKIN_ID,
    },
    appearance: DEFAULT_APPEARANCE,
  };
}

function normalizeState(rawState) {
  const base = emptyState();
  const raw = rawState && typeof rawState === "object" ? rawState : {};
  const validSkinIds = new Set(skins.map((skin) => skin.id));
  const ownedSkinIds = [
    ...new Set([DEFAULT_SKIN_ID, ...(raw.inventory?.ownedSkinIds || raw.ownedSkins || [])]),
  ].filter((skinId) => validSkinIds.has(skinId));
  const equippedSkinId = ownedSkinIds.includes(raw.inventory?.equippedSkinId)
    ? raw.inventory.equippedSkinId
    : DEFAULT_SKIN_ID;
  const backgroundIds = new Set(BACKGROUNDS.map((background) => background.id));
  const rawAppearance = raw.appearance && typeof raw.appearance === "object" ? raw.appearance : {};
  const backgroundId = backgroundIds.has(rawAppearance.backgroundId)
    ? rawAppearance.backgroundId
    : DEFAULT_APPEARANCE.backgroundId;
  const backgroundBlur = Math.min(
    30,
    Math.max(0, Number(rawAppearance.backgroundBlur ?? DEFAULT_APPEARANCE.backgroundBlur) || 0)
  );

  return {
    ...base,
    ...raw,
    tasks: Array.isArray(raw.tasks) ? raw.tasks : base.tasks,
    sessions: Array.isArray(raw.sessions) ? raw.sessions : base.sessions,
    habits: Array.isArray(raw.habits) ? raw.habits : base.habits,
    daily: raw.daily && typeof raw.daily === "object" ? raw.daily : base.daily,
    wallet: {
      ...base.wallet,
      ...(raw.wallet || {}),
      coins: Math.max(0, Number(raw.wallet?.coins ?? base.wallet.coins) || 0),
      lifetimeCoins: Math.max(
        Number(raw.wallet?.lifetimeCoins ?? raw.wallet?.coins ?? base.wallet.lifetimeCoins) || 0,
        Number(raw.wallet?.coins ?? base.wallet.coins) || 0
      ),
    },
    inventory: {
      ownedSkinIds,
      equippedSkinId,
    },
    appearance: {
      backgroundId,
      backgroundBlur,
    },
  };
}

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved ? normalizeState(JSON.parse(saved)) : emptyState();
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
  const [activeView, setActiveView] = useState("home");
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
  const [rewardNotice, setRewardNotice] = useState(null);
  const [backgroundPanelOpen, setBackgroundPanelOpen] = useState(false);
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

  const gameStats = useMemo(() => buildGameStats(state, todayKey()), [state]);
  const equippedSkin = getSkin(state.inventory?.equippedSkinId);
  const ownedSkinIds = state.inventory?.ownedSkinIds || [DEFAULT_SKIN_ID];
  const appearance = { ...DEFAULT_APPEARANCE, ...(state.appearance || {}) };
  const selectedBackground =
    BACKGROUNDS.find((background) => background.id === appearance.backgroundId) || BACKGROUNDS[0];
  const backgroundStyle = selectedBackground.image
    ? {
        "--custom-bg-image": `url(${selectedBackground.image})`,
        "--custom-bg-blur": `${appearance.backgroundBlur}px`,
      }
    : undefined;

  function showRewardNotice(amount, reason) {
    const id = uid();
    setRewardNotice({ id, amount, reason });
    window.setTimeout(() => {
      setRewardNotice((notice) => (notice?.id === id ? null : notice));
    }, 1800);
  }

  function patchAppearance(patch) {
    setState((current) => ({
      ...current,
      appearance: {
        ...DEFAULT_APPEARANCE,
        ...(current.appearance || {}),
        ...patch,
      },
    }));
  }

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
        setState(normalizeState(data.state));
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
      if (
        userId === currentUser?.id &&
        Object.prototype.hasOwnProperty.call(patch, "coins") &&
        Number.isFinite(Number(patch.coins))
      ) {
        const normalizedCoins = Math.max(0, Math.floor(Number(patch.coins)));
        setState((current) => ({
          ...current,
          wallet: {
            ...(current.wallet || {}),
            coins: normalizedCoins,
            lifetimeCoins: Math.max(Number(current.wallet?.lifetimeCoins) || 0, normalizedCoins),
          },
        }));
      }
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
    const targetTask = state.tasks.find((task) => task.id === taskId);
    const earnedCoins = targetTask && !targetTask.done && !targetTask.rewardedAt ? TASK_COIN_REWARD : 0;
    setState((current) => {
      const tasks = current.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const done = !task.done;
        const shouldReward = done && !task.rewardedAt;
        return {
          ...task,
          done,
          rewardedAt: shouldReward ? new Date().toISOString() : task.rewardedAt,
        };
      });
      return {
        ...current,
        wallet: {
          ...(current.wallet || {}),
          coins: (current.wallet?.coins || 0) + earnedCoins,
          lifetimeCoins: (current.wallet?.lifetimeCoins || 0) + earnedCoins,
        },
        tasks,
      };
    });
    if (earnedCoins) showRewardNotice(earnedCoins, "任务完成");
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
    const targetHabit = state.habits.find((habit) => habit.id === habitId);
    const wasChecked = Boolean(targetHabit?.history?.[selectedDate]);
    const earnedCoins =
      targetHabit && !wasChecked && !targetHabit.rewardedDates?.[selectedDate]
        ? HABIT_COIN_REWARD
        : 0;
    setState((current) => {
      const habits = current.habits.map((habit) => {
        if (habit.id !== habitId) return habit;
        const checked = Boolean(habit.history[selectedDate]);
        const history = { ...habit.history, [selectedDate]: !checked };
        const rewardedDates = { ...(habit.rewardedDates || {}) };
        const shouldReward = !checked && !rewardedDates[selectedDate];
        if (checked) delete history[selectedDate];
        if (shouldReward) {
          rewardedDates[selectedDate] = new Date().toISOString();
        }
        return {
          ...habit,
          history,
          rewardedDates,
          xp: Math.max(0, habit.xp + (checked ? -10 : 10)),
        };
      });
      return {
        ...current,
        wallet: {
          ...(current.wallet || {}),
          coins: (current.wallet?.coins || 0) + earnedCoins,
          lifetimeCoins: (current.wallet?.lifetimeCoins || 0) + earnedCoins,
        },
        habits,
      };
    });
    if (earnedCoins) showRewardNotice(earnedCoins, "习惯打卡");
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
    const earnedCoins = getFocusCoinReward(durationSeconds);

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
      wallet: {
        ...(snapshot.wallet || {}),
        coins: (snapshot.wallet?.coins || 0) + earnedCoins,
        lifetimeCoins: (snapshot.wallet?.lifetimeCoins || 0) + earnedCoins,
      },
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
    if (earnedCoins) showRewardNotice(earnedCoins, "专注完成");
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

  function equipSkin(skinId) {
    const skin = getSkin(skinId);
    setState((current) => {
      const owned = current.inventory?.ownedSkinIds || [DEFAULT_SKIN_ID];
      if (!owned.includes(skin.id)) return current;
      return {
        ...current,
        inventory: {
          ...current.inventory,
          ownedSkinIds: owned,
          equippedSkinId: skin.id,
        },
      };
    });
    showRewardNotice(0, `已装备 ${skin.name}`);
  }

  function buySkin(skinId) {
    const skin = getSkin(skinId);
    const owned = ownedSkinIds.includes(skin.id);
    if (owned) {
      equipSkin(skin.id);
      return;
    }
    if ((state.wallet?.coins || 0) < skin.price) {
      showRewardNotice(0, "金币还不够");
      return;
    }
    setState((current) => {
      const currentOwned = current.inventory?.ownedSkinIds || [DEFAULT_SKIN_ID];
      if (currentOwned.includes(skin.id)) return current;
      return {
        ...current,
        wallet: {
          ...(current.wallet || {}),
          coins: Math.max(0, (current.wallet?.coins || 0) - skin.price),
          lifetimeCoins: current.wallet?.lifetimeCoins || 0,
        },
        inventory: {
          ...(current.inventory || {}),
          ownedSkinIds: [...currentOwned, skin.id],
          equippedSkinId: skin.id,
        },
      };
    });
    showRewardNotice(0, `已解锁 ${skin.name}`);
  }

  function handleSpotlightMove(event) {
    const target = event.target.closest?.(".glass");
    if (!target || !event.currentTarget.contains(target)) return;
    const rect = target.getBoundingClientRect();
    target.style.setProperty("--spotlight-x", `${event.clientX - rect.left}px`);
    target.style.setProperty("--spotlight-y", `${event.clientY - rect.top}px`);
  }

  return (
    <main
      className={`app-shell ${selectedBackground.image ? "has-custom-bg" : ""}`}
      style={backgroundStyle}
      onPointerMove={handleSpotlightMove}
    >
      {selectedBackground.image && <div className="app-background" aria-hidden="true" />}
      <ClickSpark />
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      {rewardNotice && (
        <div className={`reward-toast ${rewardNotice.amount ? "coin" : "info"}`}>
          {rewardNotice.amount ? (
            <>
              <Coins size={18} />
              +{rewardNotice.amount} 金币 · {rewardNotice.reason}
            </>
          ) : (
            <>
              <Sparkles size={18} />
              {rewardNotice.reason}
            </>
          )}
        </div>
      )}

      <header className="topbar glass">
        <div>
          <p className="brand-mark">FlowDay</p>
          <h1>把每一天，修炼成喜欢的自己</h1>
        </div>
        <div className="topbar-pills">
          <div className="date-pill">
            <CalendarDays size={18} />
            <span>{formatDate(todayKey())}</span>
          </div>
          <div className="date-pill coin-pill">
            <Coins size={18} />
            <span>{state.wallet?.coins || 0} 金币</span>
          </div>
          <BackgroundSettings
            open={backgroundPanelOpen}
            setOpen={setBackgroundPanelOpen}
            appearance={appearance}
            selectedBackground={selectedBackground}
            patchAppearance={patchAppearance}
          />
        </div>
      </header>

      <nav className="view-tabs glass" aria-label="主要视图">
        <TabButton icon={Gamepad2} label="主页" active={activeView === "home"} onClick={() => setActiveView("home")} />
        <TabButton icon={ListTodo} label="今日" active={activeView === "today"} onClick={() => setActiveView("today")} />
        <TabButton icon={Clock3} label="番茄钟" active={activeView === "timer"} onClick={() => setActiveView("timer")} />
        <TabButton icon={ShoppingBag} label="商店" active={activeView === "shop"} onClick={() => setActiveView("shop")} />
        <TabButton icon={BarChart3} label="统计" active={activeView === "stats"} onClick={() => setActiveView("stats")} />
        <TabButton icon={History} label="历史" active={activeView === "history"} onClick={() => setActiveView("history")} />
        <TabButton icon={UserCog} label="账号" active={activeView === "account"} onClick={() => setActiveView("account")} />
      </nav>

      {activeView === "home" && (
        <GameHome
          stats={gameStats}
          daily={state.daily[todayKey()] || { mood: 3, energy: 3, note: "" }}
          currentUser={currentUser}
          equippedSkin={equippedSkin}
          coins={state.wallet?.coins || 0}
          ownedCount={ownedSkinIds.length}
          setActiveView={setActiveView}
        />
      )}

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

      {activeView === "shop" && (
        <SkinShop
          coins={state.wallet?.coins || 0}
          ownedSkinIds={ownedSkinIds}
          equippedSkinId={equippedSkin.id}
          buySkin={buySkin}
          equipSkin={equipSkin}
        />
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

function BackgroundSettings({ open, setOpen, appearance, selectedBackground, patchAppearance }) {
  const popover = (
    <section className="background-popover glass">
      <div className="background-popover-title">
        <div>
          <p className="eyebrow">背景</p>
          <strong>{selectedBackground.name}</strong>
        </div>
        <SlidersHorizontal size={18} />
      </div>

      <div className="background-options">
        {BACKGROUNDS.map((background) => (
          <button
            className={`background-swatch ${appearance.backgroundId === background.id ? "active" : ""} ${
              background.image ? "" : "theme-swatch"
            }`}
            key={background.id}
            onClick={() => patchAppearance({ backgroundId: background.id })}
            style={background.image ? { backgroundImage: `url(${background.image})` } : undefined}
            type="button"
            aria-label={background.name}
            title={background.name}
          >
            <span>{background.image ? background.name.replace("背景 ", "") : "主题"}</span>
          </button>
        ))}
      </div>

      <label className="background-blur">
        <span>模糊度 {appearance.backgroundBlur}px</span>
        <input
          type="range"
          min="0"
          max="30"
          value={appearance.backgroundBlur}
          onChange={(event) => patchAppearance({ backgroundBlur: Number(event.target.value) })}
          disabled={!selectedBackground.image}
        />
      </label>
    </section>
  );

  return (
    <div className="background-control">
      <button
        className="icon-button background-trigger"
        onClick={() => setOpen((value) => !value)}
        aria-label="背景设置"
        type="button"
      >
        <Settings size={18} />
      </button>

      {open && createPortal(popover, document.body)}
    </div>
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

function GameHome({ stats, daily, currentUser, equippedSkin, coins, ownedCount, setActiveView }) {
  const [avatarEffectKey, setAvatarEffectKey] = useState("");
  const [avatarEffectType, setAvatarEffectType] = useState("standee");
  const avatarEffectTimerRef = useRef(null);

  useEffect(() => {
    return () => window.clearTimeout(avatarEffectTimerRef.current);
  }, []);

  function triggerAvatarEffect() {
    const effectId = uid();
    const effectType = AVATAR_EFFECT_TYPES[Math.floor(Math.random() * AVATAR_EFFECT_TYPES.length)];
    window.clearTimeout(avatarEffectTimerRef.current);
    setAvatarEffectKey(effectId);
    setAvatarEffectType(effectType);
    avatarEffectTimerRef.current = window.setTimeout(() => {
      setAvatarEffectKey("");
      setAvatarEffectType("standee");
    }, 1500);
  }

  return (
    <section className="game-home">
      <section className="game-hero glass">
        <div className="game-copy">
          <p className="hub-mark">Life RPG Hub</p>
          <h2>{currentUser?.displayName || "今日玩家"} 的生活据点</h2>
          <p>
            完成任务、专注计时、坚持习惯都会变成经验值。今天的状态越清楚，角色升级越稳定。
          </p>

          <div className="level-card">
            <div className="level-emblem">
              <Crown size={24} />
              <strong>Lv.{stats.level}</strong>
            </div>
            <div className="level-main">
              <div className="level-title">
                <span>{stats.title}</span>
                <strong>{stats.xpInLevel}/{stats.nextLevelXp} XP</strong>
              </div>
              <div className="xp-track">
                <div className="xp-fill" style={{ width: `${stats.progress}%` }} />
              </div>
            </div>
          </div>

          <div className="hub-actions">
            <button className="primary-button large" onClick={() => setActiveView("timer")}>
              <Zap size={19} />
              开始专注
            </button>
            <button className="ghost-button large" onClick={() => setActiveView("today")}>
              <ListTodo size={19} />
              今日任务
            </button>
            <button className="ghost-button large" onClick={() => setActiveView("shop")}>
              <ShoppingBag size={19} />
              皮肤商店
            </button>
            <button className="ghost-button large" onClick={() => setActiveView("stats")}>
              <BarChart3 size={19} />
              战绩统计
            </button>
          </div>
        </div>

        <div className="avatar-zone" aria-label="像素角色">
          <div
            className={`avatar-stage ${avatarEffectKey ? `is-casting effect-${avatarEffectType}` : ""}`}
            role="button"
            tabIndex="0"
            aria-label="触发角色特效"
            onClick={triggerAvatarEffect}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                triggerAvatarEffect();
              }
            }}
          >
            <PixelHero
              skin={equippedSkin}
              mood={daily.mood}
              energy={daily.energy}
              level={stats.level}
              effectKey={avatarEffectKey}
              effectType={avatarEffectType}
            />
            {avatarEffectKey && <AvatarBurst key={avatarEffectKey} type={avatarEffectType} />}
            <div className="avatar-shadow" />
          </div>
          <div className="skin-nameplate">
            <span>{equippedSkin.title}</span>
            <strong>{equippedSkin.name}</strong>
          </div>
          <div className="status-crystals">
            <span>
              <HeartPulse size={16} />
              心情 {daily.mood}/5
            </span>
            <span>
              <Zap size={16} />
              精力 {daily.energy}/5
            </span>
            <span>
              <Coins size={16} />
              {coins} 金币
            </span>
            <span>
              <Shirt size={16} />
              {ownedCount}/{skins.length} 皮肤
            </span>
          </div>
        </div>
      </section>

      <section className="quest-grid">
        <QuestCard
          icon={Target}
          title="今日任务"
          value={`${stats.todayDone}/${stats.todayTasks}`}
          detail="每完成一个 TODO 都会给角色加经验"
          progress={stats.todayTaskProgress}
          onClick={() => setActiveView("today")}
        />
        <QuestCard
          icon={Clock3}
          title="今日专注"
          value={formatMinutes(stats.todayFocus)}
          detail="专注时间越稳定，成长条越亮"
          progress={stats.todayFocusProgress}
          onClick={() => setActiveView("timer")}
        />
        <QuestCard
          icon={Flame}
          title="习惯连击"
          value={`${stats.todayHabits}/${stats.habitTotal}`}
          detail="打卡会累积习惯经验和连续天数"
          progress={stats.habitProgress}
          onClick={() => setActiveView("today")}
        />
        <QuestCard
          icon={Gem}
          title="金币库存"
          value={`${coins}`}
          detail="完成任务、打卡和专注可获得金币"
          progress={stats.progress}
          onClick={() => setActiveView("shop")}
        />
      </section>
    </section>
  );
}

function PixelHero({ skin, mood, energy, level, effectKey, effectType }) {
  const expression = mood >= 4 ? "happy" : mood <= 2 ? "low" : "steady";
  return (
    <div
      className={`pixel-hero image-hero ${expression}`}
      style={{
        "--level-glow": Math.min(1, level / 12),
        "--skin-accent": skin.accent,
        "--energy-glow": 0.25 + energy * 0.1,
      }}
    >
      <div className="pixel-aura" />
      <div
        className={`pixel-character skin-character ${effectKey ? `avatar-action effect-${effectType}` : ""}`}
        key={`${skin.id}-${effectKey || "idle"}`}
      >
        <img src={skin.image} alt={skin.name} />
        <span className="skin-sheen" />
        <span className="energy-core image-core" />
      </div>
    </div>
  );
}

function AvatarBurst({ type }) {
  return (
    <div className={`avatar-burst burst-${type}`} aria-hidden="true">
      {Array.from({ length: 14 }).map((_, index) => (
        <span
          key={index}
          style={{
            "--burst-angle": `${index * 25.7}deg`,
            "--burst-distance": `${82 + (index % 4) * 22}px`,
            "--burst-delay": `${(index % 5) * 35}ms`,
          }}
        />
      ))}
    </div>
  );
}

function QuestCard({ icon: Icon, title, value, detail, progress, onClick }) {
  return (
    <button className="quest-card glass" onClick={onClick}>
      <span className="quest-icon">
        <Icon size={20} />
      </span>
      <span className="quest-title">{title}</span>
      <strong>{value}</strong>
      <span className="quest-detail">{detail}</span>
      <span className="quest-track">
        <span style={{ width: `${Math.min(100, Math.max(0, progress))}%` }} />
      </span>
    </button>
  );
}

function SkinShop({ coins, ownedSkinIds, equippedSkinId, buySkin, equipSkin }) {
  const ownedSet = new Set(ownedSkinIds);
  return (
    <section className="shop-layout">
      <section className="shop-hero glass">
        <div>
          <p className="eyebrow">SKIN SHOP</p>
          <h2>像素衣柜</h2>
          <p>用今天的任务、专注和习惯，把角色一点点养成你喜欢的样子。</p>
        </div>
        <div className="wallet-card">
          <Coins size={24} />
          <span>当前金币</span>
          <strong>{coins}</strong>
        </div>
        <div className="wallet-card">
          <Shirt size={24} />
          <span>已拥有</span>
          <strong>{ownedSkinIds.length}/{skins.length}</strong>
        </div>
      </section>

      <section className="skin-grid">
        {skins.map((skin) => {
          const owned = ownedSet.has(skin.id);
          const equipped = equippedSkinId === skin.id;
          const canBuy = coins >= skin.price;
          const rarity = rarityMeta[skin.rarity];
          return (
            <article
              className={`skin-card glass ${owned ? "owned" : "locked"} ${equipped ? "equipped" : ""}`}
              key={skin.id}
              style={{ "--skin-accent": skin.accent, "--rarity-tone": rarity.tone }}
            >
              <div className="skin-card-stage">
                <span className="rarity-badge">{rarity.label}</span>
                {equipped && <span className="equipped-badge">使用中</span>}
                {!owned && (
                  <span className="lock-badge">
                    <LockKeyhole size={15} />
                  </span>
                )}
                <img src={skin.image} alt={skin.name} />
                <span className="skin-card-shadow" />
              </div>
              <div className="skin-card-body">
                <div>
                  <h3>{skin.name}</h3>
                  <p>{skin.title}</p>
                </div>
                <strong className="price-tag">
                  <Coins size={16} />
                  {skin.price}
                </strong>
              </div>
              {equipped ? (
                <button className="ghost-button" disabled>
                  <Check size={17} />
                  已装备
                </button>
              ) : owned ? (
                <button className="primary-button" onClick={() => equipSkin(skin.id)}>
                  <Shirt size={17} />
                  装备
                </button>
              ) : (
                <button
                  className={canBuy ? "primary-button" : "ghost-button"}
                  onClick={() => buySkin(skin.id)}
                >
                  {canBuy ? <ShoppingBag size={17} /> : <LockKeyhole size={17} />}
                  {canBuy ? "购买" : "金币不足"}
                </button>
              )}
            </article>
          );
        })}
      </section>
    </section>
  );
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

function buildGameStats(state, date) {
  const totalFocus = state.sessions.reduce((sum, session) => sum + session.durationSeconds, 0);
  const todayFocus = state.sessions
    .filter((session) => session.date === date)
    .reduce((sum, session) => sum + session.durationSeconds, 0);
  const completedTasks = state.tasks.filter((task) => task.done).length;
  const todayTasks = state.tasks.filter((task) => task.date === date);
  const todayDone = todayTasks.filter((task) => task.done).length;
  const habitChecks = state.habits.reduce(
    (sum, habit) => sum + Object.values(habit.history || {}).filter(Boolean).length,
    0
  );
  const todayHabits = state.habits.filter((habit) => habit.history?.[date]).length;
  const totalXp = Math.round(totalFocus / 60) * 4 + completedTasks * 18 + habitChecks * 12;
  const nextLevelXp = 120;
  const level = Math.floor(totalXp / nextLevelXp) + 1;
  const xpInLevel = totalXp % nextLevelXp;
  const titles = ["新手整理师", "专注见习生", "节奏冒险家", "习惯骑士", "时间炼金师", "生活统筹官"];
  const title = titles[Math.min(titles.length - 1, Math.floor((level - 1) / 2))];

  return {
    totalXp,
    level,
    title,
    xpInLevel,
    nextLevelXp,
    progress: (xpInLevel / nextLevelXp) * 100,
    todayFocus,
    todayTasks: todayTasks.length,
    todayDone,
    todayHabits,
    habitTotal: state.habits.length,
    todayTaskProgress: todayTasks.length ? (todayDone / todayTasks.length) * 100 : 0,
    todayFocusProgress: Math.min(100, (todayFocus / 3600) * 100),
    habitProgress: state.habits.length ? (todayHabits / state.habits.length) * 100 : 0,
  };
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
  const [coins, setCoins] = useState(user.coins ?? 0);
  const [password, setPassword] = useState("");
  const isSelf = user.id === currentUser.id;

  useEffect(() => {
    setDisplayName(user.displayName);
    setRole(user.role);
    setCoins(user.coins ?? 0);
    setPassword("");
  }, [user.id, user.displayName, user.role, user.coins]);

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

      <label className="admin-coin-field">
        <Coins size={16} />
        <input
          type="number"
          min="0"
          max="9999999"
          value={coins}
          onChange={(event) => setCoins(event.target.value)}
          aria-label={`${user.username} 金币数量`}
        />
      </label>
      <button
        className="ghost-button"
        onClick={() => updateAdminUser(user.id, { coins: Number(coins) })}
      >
        <Coins size={16} />
        改金币
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
