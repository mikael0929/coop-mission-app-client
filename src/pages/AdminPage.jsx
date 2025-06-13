import React, { useEffect, useRef, useState } from "react";
import io from "socket.io-client";
import "./AdminPage.css";

const socket = io();

const AdminPage = () => {
  const missions = [1, 2, 3, 4, 5];
  const [activeMissions, setActiveMissions] = useState({});
  const [completedMissions, setCompletedMissions] = useState({});
  const [timers, setTimers] = useState({});
  const timerRefs = useRef({});

  // ✅ 완료된 미션은 제외하고, 실패나 진행중인 미션이 있을 때만 잠금
  const isAnyBlocked = missions.some((id) => {
    const isCompleted = completedMissions[id];
    const isActive = activeMissions[id];
    const hasFailed = timers[id] > 0 && !isActive && !isCompleted;
    return !isCompleted && (isActive || hasFailed);
  });

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const startTimer = (num) => {
    if (timerRefs.current[num]) return;
    timerRefs.current[num] = setInterval(() => {
      setTimers((prev) => ({
        ...prev,
        [num]: (prev[num] || 0) + 1,
      }));
    }, 1000);
  };

  const stopTimer = (num) => {
    clearInterval(timerRefs.current[num]);
    timerRefs.current[num] = null;
  };

  const toggleMission = (num) => {
    if (isAnyBlocked && !activeMissions[num]) return;

    setActiveMissions((prev) => {
      const nowActive = !prev[num];
      if (nowActive) {
        startTimer(num);
        setCompletedMissions((c) => ({ ...c, [num]: false }));
      } else {
        stopTimer(num);
      }
      return { ...prev, [num]: nowActive };
    });

    socket.emit("admin-mission-activate", num);
  };

  const resetMission = (num) => {
    if (!window.confirm(`미션 ${num}을 초기화할까요?`)) return;
    stopTimer(num);
    setActiveMissions((prev) => ({ ...prev, [num]: false }));
    setCompletedMissions((prev) => ({ ...prev, [num]: false }));
    setTimers((prev) => ({ ...prev, [num]: 0 }));
    socket.emit("admin-reset-mission", num);
  };

  const resetAll = () => {
    if (!window.confirm("전체 미션을 초기화할까요?")) return;
    missions.forEach((num) => stopTimer(num));
    setActiveMissions({});
    setCompletedMissions({});
    setTimers({});
    socket.emit("admin-reset-all");
  };

  const completeMission = (num) => {
    if (!window.confirm(`미션 ${num}을 완료로 표시할까요?`)) return;
    stopTimer(num);
    setActiveMissions((prev) => ({ ...prev, [num]: false }));
    setCompletedMissions((prev) => ({ ...prev, [num]: true }));
    socket.emit("mission-complete", num);
  };

  useEffect(() => {
    socket.on("admin-mission-activate", (missionId) => {
      setActiveMissions((prev) => ({ ...prev, [missionId]: true }));
      startTimer(missionId);
    });
    return () => {
      socket.off("admin-mission-activate");
    };
  }, []);

  return (
    <div className="admin-container">
      <h1>🔧 관리자 화면</h1>
      <button onClick={resetAll} style={{ marginBottom: "1rem" }}>🔄 전체 초기화</button>
      <div className="mission-grid">
        {missions.map((num) => {
          const isThisActive = activeMissions[num];
          const isCompleted = completedMissions[num];
          const hasFailed = timers[num] > 0 && !isThisActive && !isCompleted;

          // 다른 미션이 진행 중 또는 실패 상태인지 확인
          const anyOtherBlocking = missions.some((id) => {
            if (id === num) return false;
            const active = activeMissions[id];
            const complete = completedMissions[id];
            const failed = timers[id] > 0 && !active && !complete;
            return !complete && (active || failed);
          });

          const disableThis = !isThisActive && anyOtherBlocking;

          return (
            <div key={num} className="mission-card">
              <div
                className={`mission-box ${
                  isCompleted
                    ? "completed"
                    : isThisActive
                    ? "active"
                    : hasFailed
                    ? "failed"
                    : ""
                }`}
                onClick={() => {
                  if (!disableThis) toggleMission(num);
                }}
                style={{
                  pointerEvents: disableThis ? "none" : "auto",
                  opacity: disableThis ? 0.5 : 1,
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
