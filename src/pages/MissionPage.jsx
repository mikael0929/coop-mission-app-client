import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io();
const missionDurations = {
  1: 8,
  2: 300,
  3: 300,
  4: 300,
  5: 300,
  6: 30,
  7: 5,
};

const sentenceSet = [
  "5개의 문장이 차례대로 나옵니다! 외워야 합니다 집중하세요!",
  "하느님께서 말씀하시기를 “빛이 생겨라.” 하시자 빛이 생겼다.",
  "“하늘 아래에 있는 물은 한곳으로 모여, 뭍이 드러나라.” 하시자, 그대로 되었다.",
  "씨를 맺는 풀과 씨 있는 과일나무를 제 종류대로 땅 위에 돋게 하여라.",
  "그분께서는 하시던 일을 모두 마치시고 이렛날에 쉬셨다.",
  "하느님께서 보시니 좋았다.",
];

const MissionPage = () => {
  const { missionId } = useParams();
  const missionNum = Number(missionId);
  const [timeLeft, setTimeLeft] = useState(null);
  const [status, setStatus] = useState("checking");
  const [globalStatus, setGlobalStatus] = useState({
    runningMissions: [],
    failedMissions: [],
    completedMissions: [],
  });
  const [isCompleted, setIsCompleted] = useState(false);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [timerRef, setTimerRef] = useState(null);

  useEffect(() => {
    socket.emit("request-global-status");
    socket.on("global-status", ({ running, failed, completed }) => {
      setGlobalStatus({
        runningMissions: running,
        failedMissions: failed,
        completedMissions: completed ?? [],
      });

      if (completed?.includes(missionNum)) {
        setIsCompleted(true);
        setStatus("done");
      }
    });
    return () => {
      socket.off("global-status");
    };
  }, [missionNum]);

  useEffect(() => {
    socket.emit("check-failure", missionNum);
    socket.on("failure-status", ({ missionId: id, isFailed }) => {
      if (Number(id) === missionNum) {
        if (!isCompleted) {
          setStatus(isFailed ? "failed" : "ready");
          if (!isFailed) {
            setTimeLeft(missionDurations[missionNum] ?? 10);
          }
        }
      }
    });
    return () => {
      socket.off("failure-status");
    };
  }, [missionId, isCompleted]);

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
    setTimerRef(timer);
  };

  useEffect(() => {
    if (missionNum === 6 && status === "active") {
      const interval = setInterval(() => {
        setSentenceIndex((prev) => (prev + 1) % sentenceSet.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [missionNum, status]);

  useEffect(() => {
    socket.on("mission-complete", (completedId) => {
      if (Number(completedId) === missionNum) {
        if (timerRef) clearInterval(timerRef);
        setIsCompleted(true);
        setStatus("done");
      }
    });
    return () => {
      socket.off("mission-complete");
    };
  }, [missionNum, timerRef]);

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
        setTimerRef(timer);
      }
    });
    return () => {
      socket.off("mission-start");
    };
  }, [status, missionNum]);

  useEffect(() => {
    socket.on("participant-reset", (resetId) => {
      if (resetId === -1 || resetId === missionNum) {
      setIsCompleted(false);
      setStatus("ready");
      setTimeLeft(missionDurations[missionNum] ?? 10);
      setGlobalStatus((prev) => ({
        ...prev,
        completedMissions: prev.completedMissions.filter((id) => id !== missionNum),
      }));
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
        <h1>❌ 미션 {missionId} 종료</h1>
        <p>제한시간이 끝났습니다. 선생님께 가서 검사받으세요</p>
      </div>
    );
  }

  if (status === "done") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>✅ 미션 {missionId} 완료</h1>
        <p>미션을 성공적으로 수행했습니다. 선생님께 가서 검사받으세요~</p>
      </div>
    );
  }

  if (status === "active") {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>
        <h1>🧩 미션 {missionId}</h1>
        {missionNum === 6 ? (
          <>
            <p style={{ fontSize: "1.5rem" }}>{sentenceSet[sentenceIndex]}</p>
            <p>⏳ 남은 시간: {timeLeft}초</p>
          </>
        ) : (
          <>
            <p>이 미션을 수행하세요!</p>
            <img
              src={`/images/mission${missionId}.png`}
              alt={`미션 ${missionId}`}
              style={{ maxWidth: "300px", margin: "1rem auto", display: "block" }}
            />
            <p style={{ fontSize: "1.5rem" }}>⏳ 남은 시간: {timeLeft}초</p>
          </>
        )}
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
