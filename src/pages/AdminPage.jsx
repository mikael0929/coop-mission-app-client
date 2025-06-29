import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./AdminPage.css";

const socket = io("https://coop-mission-app-server.onrender.com");

const AdminPage = () => {
  const missions = [1, 2, 3, 4, 5, 6, 7];
  const [missionStates, setMissionStates] = useState({});
  const [timers, setTimers] = useState({});
  const timerRefs = useRef({});

  const missionDurations = {
    1: 8,
    2: 300,
    3: 300,
    4: 300,
    5: 300,
    6: 30,
    7: 5,
  };

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const startTimer = (num) => {
    if (timerRefs.current[num]) return;
    const total = missionDurations[num] || 10;
    setTimers((prev) => ({ ...prev, [num]: total }));
    timerRefs.current[num] = setInterval(() => {
      setTimers((prev) => {
        const newTime = (prev[num] || total) - 1;
        if (newTime <= 0) {
          clearInterval(timerRefs.current[num]);
          timerRefs.current[num] = null;
        }
        return { ...prev, [num]: newTime };
      });
    }, 1000);
  };

  const stopTimer = (num) => {
    clearInterval(timerRefs.current[num]);
    timerRefs.current[num] = null;
  };

  const toggleMission = (num) => {
    const state = missionStates[num] || {};
    const isOtherMissionRunning = Object.entries(missionStates).some(
      ([id, s]) => Number(id) !== num && s.inProgress
    );
    if (isOtherMissionRunning || state.failed || state.success) return;

    const isActive = !state.inProgress;

    setMissionStates((prev) => ({
      ...prev,
      [num]: {
        ...prev[num],
        inProgress: isActive,
        waiting: !isActive,
      },
    }));

    if (isActive) startTimer(num);
    else stopTimer(num);

    socket.emit("mission-start", num);
  };

  const resetMission = (num) => {
    if (!window.confirm(`미션 ${num}을 초기화할까요?`)) return;
    stopTimer(num);
    setTimers((prev) => ({ ...prev, [num]: missionDurations[num] || 10 }));
    setMissionStates((prev) => ({
      ...prev,
      [num]: {
        reset: true,
        success: false,
        failed: false,
        inProgress: false,
      },
    }));
    socket.emit("admin-reset-mission", num);
    setTimeout(() => {
      setMissionStates((prev) => ({
        ...prev,
        [num]: {
          ...prev[num],
          reset: false,
        },
      }));
    }, 100);
  };

  const resetAll = () => {
    if (!window.confirm("전체 미션을 초기화할까요?")) return;
    missions.forEach((num) => {
      stopTimer(num);
      setTimers((prev) => ({ ...prev, [num]: missionDurations[num] || 10 }));
    });
    const newStates = {};
    missions.forEach((num) => {
      newStates[num] = {
        reset: true,
        success: false,
        failed: false,
        inProgress: false,
      };
    });
    setMissionStates(newStates);
    socket.emit("admin-reset-all");
    setTimeout(() => {
      const clearedStates = {};
      missions.forEach((num) => {
        clearedStates[num] = {
          ...newStates[num],
          reset: false,
        };
      });
      setMissionStates(clearedStates);
    }, 100);
  };

  const completeMission = (num) => {
    if (!window.confirm(`미션 ${num}을 완료로 표시할까요?`)) return;
    if (missionStates[num]?.success) return;
    stopTimer(num);
    setMissionStates((prev) => ({
      ...prev,
      [num]: {
        ...prev[num],
        inProgress: false,
        success: true,
        failed: false,
      },
    }));
    socket.emit("mission-complete", num);
  };

  useEffect(() => {
    socket.emit("request-global-status");
    const handleStatus = (serverState) => {
      const newStates = {};
      const newTimers = {};
      missions.forEach((i) => {
        const isRunning = serverState.running?.includes(i);
        const isFailed = serverState.failed?.includes(i);
        const isSuccess = serverState.completed?.includes(i);
        newStates[i] = {
          reset: false,
          success: isSuccess,
          failed: isFailed,
          inProgress: isRunning,
        };
        newTimers[i] = missionDurations[i];
        if (isRunning) startTimer(i);
      });
      setMissionStates(newStates);
      setTimers(newTimers);
    };

    socket.on("global-status", handleStatus);

    return () => {
      socket.off("global-status", handleStatus);
    };
  }, []);

  useEffect(() => {
    const handleMissionUpdate = (id) => {
      socket.emit("request-global-status");
    };
    socket.on("mission-complete", handleMissionUpdate);
    socket.on("admin-reset-mission", handleMissionUpdate);
    socket.on("admin-reset-all", handleMissionUpdate);
    socket.on("mission-start", handleMissionUpdate);
    return () => {
      socket.off("mission-complete", handleMissionUpdate);
      socket.off("admin-reset-mission", handleMissionUpdate);
      socket.off("admin-reset-all", handleMissionUpdate);
      socket.off("mission-start", handleMissionUpdate);
    };
  }, []);

  return (
    <div className="admin-container">
      <h1>🔧 관리자 화면</h1>
      <button onClick={resetAll} style={{ marginBottom: "1rem" }}>🔄 전체 초기화</button>
      <div className="mission-grid">
        {missions.map((num) => {
          const state = missionStates[num] || {};
          const isDisabled = Object.values(missionStates).some(
            (s, idx) => idx + 1 !== num && (s.inProgress || s.failed)
          );

          return (
            <div key={num} className="mission-card">
              <div
                className={`mission-box ${
                  state.success ? "completed" :
                  state.inProgress ? "active" :
                  state.failed ? "failed" : ""
                }`}
                onClick={() => {
                  if (!isDisabled) toggleMission(num);
                }}
                style={{
                  pointerEvents: isDisabled ? "none" : "auto",
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                미션 {num}
              </div>
              <div className="mission-controls">
                <div className="timer">⏱ {formatTime(timers[num] || 0)}</div>
                <button onClick={() => resetMission(num)}>초기화</button>
                <button onClick={() => completeMission(num)}>완료</button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminPage;
