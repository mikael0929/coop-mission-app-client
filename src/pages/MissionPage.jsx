import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io();
const missionDurations = {
  1: 10,
  2: 15,
  3: 20,
  4: 25,
  5: 30,
};

const MissionPage = () => {
  const { missionId } = useParams();
  const missionNum = Number(missionId);
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState("checking"); // checking | ready | active | failed | done
  const [globalStatus, setGlobalStatus] = useState({
    runningMissions: [],
    failedMissions: [],
    completedMissions: [],
  });
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    socket.emit("request-global-status");
    socket.on("global-status", ({ running, failed, completed }) => {
      setGlobalStatus({
        runningMissions: running,
        failedMissions: failed,
        completedMissions: completed ?? [],
      });
    });
    return () => {
      socket.off("global-status");
    };
  }, []);

  useEffect(() => {
    socket.emit("check-failure", missionNum);
    socket.on("failure-status", ({ missionId: id, isFailed }) => {
      if (Number(id) === missionNum) {
        setStatus(isFailed ? "failed" : "ready");
        if (!isFailed) {
          setTimeLeft(missionDurations[missionNum] ?? 10);
        }
      }
    });
    return () => {
      socket.off("failure-status");
    };
  }, [missionId]);

  const handleMissionStart = () => {
    if (status === "failed" || status === "done") return;

    const isBlockedByFailure =
      globalStatus.failedMissions.length > 0 &&
      !globalStatus.failedMissions.includes(missionNum);

    const isRunningOther =
      globalStatus.runningMissions.some(
        (id) =>
          id !== missionNum &&
          !globalStatus.completedMissions.includes(id)
        );

      

    if (isBlockedByFailure) {
      alert("실패한 미션이 있습니다. 선생님에게 가세요~");
      return;
    }

    if (isRunningOther) {
      alert("다른 미션이 수행 중 입니다");
      return;
    }

    const duration = missionDurations[missionNum] ?? 10;
    setTimeLeft(duration);
    socket.emit("mission-start", missionNum);
    setStatus("active");

    let current = duration;
    const timer = setInterval(() => {
      current -= 1;
      setTimeLeft(current);
      if (current <= 0) {
        clearInterval(timer);
        setStatus("failed");
        socket.emit("mark-failed", missionNum);
      }
    }, 1000);
  };

  useEffect(() => {
    socket.on("mission-complete", (completedId) => {
      if (Number(completedId) === missionNum) {
        setIsCompleted(true);
        setStatus("done");
      }
    });
    return () => {
      socket.off("mission-complete");
    };
  }, [missionNum]);

  useEffect(() => {
    socket.on("mission-start", (startedId) => {
      if (Number(startedId) === missionNum && status !== "active") {
        const duration = missionDurations[missionNum] ?? 10;
        setTimeLeft(duration);
        setStatus("active");

        let current = duration;
        const timer = setInterval(() => {
          current -= 1;
          setTimeLeft(current);
          if (current <= 0) {
            clearInterval(timer);
            setStatus("failed");
            socket.emit("mark-failed", missionNum);
          }
        }, 1000);
      }
    });
    return () => {
      socket.off("mission-start");
    };
  }, [status, missionNum]);

  useEffect(() => {
    socket.on("participant-reset", (resetId) => {
      if (resetId === -1 || resetId === missionNum) {
        window.location.reload();
      }
    });
    return () => {
      socket.off("participant-reset");
    };
  }, [missionId]);

  if (status === "checking") {
    return <div style={{ padding: "2rem", textAlign: "center" }}>⏳ 상태 확인 중...</div>;
  }

  if (status === "failed") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>❌ 미션 {missionId} 실패</h1>
        <p>제한시간 내에 수행하지 못했습니다.</p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>✅ 미션 {missionId} 완료</h1>
        <p>미션을 성공적으로 수행했습니다. 다른 미션을 수행해보세요!</p>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>🧩 미션 {missionId}</h1>
        <p>이 미션을 수행하세요!</p>
        <img
          src={`/images/mission${missionId}.png`}
          alt={`미션 ${missionId}`}
          style={{ maxWidth: "300px", margin: "1rem auto", display: "block" }}
        />
        <p style={{ fontSize: "1.5rem" }}>⏳ 남은 시간: {timeLeft}초</p>
      </div>
    );
  }

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>🎯 미션 {missionId}</h1>
      <button onClick={handleMissionStart} style={{ fontSize: "1.5rem", padding: "1rem" }}>
        미션 확인
      </button>
    </div>
  );
};

export default MissionPage;
