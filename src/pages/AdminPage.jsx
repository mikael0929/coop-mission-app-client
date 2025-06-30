import React, { useEffect, useState } from "react";
import io from "socket.io-client";
import "./AdminPage.css";

const socket = io("https://coop-mission-app-server.onrender.com");

const AdminPage = () => {
  const missions = [1, 2, 3, 4, 5, 6, 7];
  const [missionStates, setMissionStates] = useState({});
  const [durations, setDurations] = useState({});

  const formatTime = (sec) => {
    const m = String(Math.floor(sec / 60)).padStart(2, "0");
    const s = String(sec % 60).padStart(2, "0");
    return `${m}:${s}`;
  };

  const toggleMission = (num) => {
    const state = missionStates[num] || {};
    const otherRunning = Object.entries(missionStates).some(
      ([id, s]) => Number(id) !== num && s.inProgress
    );
    const hasFailure = Object.values(missionStates).some((s) => s.failed);
    if (otherRunning || hasFailure || state.success || state.failed) return;

    socket.emit("mission-start", num);
  };

  const resetMission = (num) => {
    if (window.confirm(`미션 ${num}을 초기화할까요?`)) {
      socket.emit("admin-reset-mission", num);
    }
  };

  const resetAll = () => {
    if (window.confirm("전체 미션을 초기화할까요?")) {
      socket.emit("admin-reset-all");
    }
  };

  const completeMission = (num) => {
    if (!missionStates[num]?.success && window.confirm(`미션 ${num}을 완료로 표시할까요?`)) {
      socket.emit("mission-complete", num);
    }
  };

  useEffect(() => {
    socket.emit("request-global-status");

    const handleStatus = (serverState) => {
      const { running = [], failed = [], completed = [], durations = {} } = serverState;
      const newStates = {};
      missions.forEach((i) => {
        newStates[i] = {
          inProgress: running.includes(i),
          failed: failed.includes(i),
          success: completed.includes(i),
        };
      });
      setMissionStates(newStates);
      setDurations(durations);
    };

    socket.on("global-status", handleStatus);
    return () => socket.off("global-status", handleStatus);
  }, []);

  useEffect(() => {
    const refresh = () => socket.emit("request-global-status");

    socket.on("mission-start", refresh);
    socket.on("mission-complete", refresh);
    socket.on("admin-reset-all", refresh);
    socket.on("admin-reset-mission", refresh);
    socket.on("mark-failed", refresh);

    return () => {
      socket.off("mission-start", refresh);
      socket.off("mission-complete", refresh);
      socket.off("admin-reset-all", refresh);
      socket.off("admin-reset-mission", refresh);
      socket.off("mark-failed", refresh);
    };
  }, []);

  return (
    <div className="admin-container">
      <h1>🔧 관리자 화면</h1>
      <button onClick={resetAll} style={{ marginBottom: "1rem" }}>🔄 전체 초기화</button>
      <div className="mission-grid">
        {missions.map((num) => {
          const state = missionStates[num] || {};
          const isDisabled = Object.entries(missionStates).some(
            ([id, s]) => Number(id) !== num && (s.inProgress || s.failed)
          );

          return (
            <div key={num} className="mission-card">
              <div
                className={`mission-box ${
                  state.success ? "completed" :
                  state.inProgress ? "active" :
                  state.failed ? "failed" : ""
                }`}
                onClick={() => !isDisabled && toggleMission(num)}
                style={{
                  pointerEvents: isDisabled ? "none" : "auto",
                  opacity: isDisabled ? 0.5 : 1,
                }}
              >
                미션 {num}
              </div>
              <div className="mission-controls">
                <div className="timer">⏱ {formatTime(durations[num] || 0)}</div>
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
