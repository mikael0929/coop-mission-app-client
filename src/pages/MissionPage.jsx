import React, { useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { io } from "socket.io-client";

const socket = io("https://coop-mission-app-server.onrender.com");

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
  const [status, setStatus] = useState("checking");
  const [timeLeft, setTimeLeft] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);
  const [sentenceIndex, setSentenceIndex] = useState(0);
  const [globalStatus, setGlobalStatus] = useState({ running: [], failed: [], completed: [] });
  const timerRef = useRef(null);

  useEffect(() => {
    socket.emit("request-global-status");
    socket.emit("check-failure", missionNum);

    const handleGlobalStatus = ({ running, failed, completed }) => {
      setGlobalStatus({ running, failed, completed });
      if (completed.includes(missionNum)) {
        setIsCompleted(true);
        setStatus("done");
      }
    };

    const handleFailureStatus = ({ missionId: id, isFailed }) => {
      if (Number(id) === missionNum) {
        if (!isCompleted) {
          setStatus(isFailed ? "failed" : "ready");
          if (!isFailed) setTimeLeft(missionDurations[missionNum] ?? 10);
        }
      }
    };

    const handleMissionComplete = (id) => {
      if (Number(id) === missionNum) {
        clearInterval(timerRef.current);
        setIsCompleted(true);
        setStatus("done");
      }
    };

    const handleMissionStart = (id) => {
      if (Number(id) === missionNum && status !== "active") {
        const duration = missionDurations[missionNum] ?? 10;
        setTimeLeft(duration);
        setStatus("active");
        startCountdown(duration);
      }
    };

    const handleReset = (id) => {
      if (id === -1 || id === missionNum) {
        clearInterval(timerRef.current);
        setIsCompleted(false);
        setStatus("ready");
        setTimeLeft(missionDurations[missionNum] ?? 10);
      }
    };

    socket.on("global-status", handleGlobalStatus);
    socket.on("failure-status", handleFailureStatus);
    socket.on("mission-complete", handleMissionComplete);
    socket.on("mission-start", handleMissionStart);
    socket.on("participant-reset", handleReset);

    return () => {
      socket.off("global-status", handleGlobalStatus);
      socket.off("failure-status", handleFailureStatus);
      socket.off("mission-complete", handleMissionComplete);
      socket.off("mission-start", handleMissionStart);
      socket.off("participant-reset", handleReset);
    };
  }, [missionNum, isCompleted, status]);

  const startCountdown = (duration) => {
    let current = duration;
    timerRef.current = setInterval(() => {
      current -= 1;
      setTimeLeft(current);
      if (current <= 0) {
        clearInterval(timerRef.current);
        setStatus("failed");
        socket.emit("mark-failed", missionNum);
      }
    }, 1000);
  };

  const handleStart = () => {
    if (status === "failed" || status === "done") return;

    const isBlocked =
      globalStatus.failed.length > 0 && !globalStatus.failed.includes(missionNum);
    const isOtherRunning =
      globalStatus.running.some(
        (id) => id !== missionNum && !globalStatus.completed.includes(id)
      );

    if (isBlocked) return alert("실패한 미션이 있습니다. 선생님에게 가세요~");
    if (isOtherRunning) return alert("다른 미션이 수행 중 입니다");

    const duration = missionDurations[missionNum] ?? 10;
    setTimeLeft(duration);
    setStatus("active");
    socket.emit("mission-start", missionNum);
    startCountdown(duration);
  };

  useEffect(() => {
    if (missionNum === 6 && status === "active") {
      const interval = setInterval(() => {
        setSentenceIndex((prev) => (prev + 1) % sentenceSet.length);
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [missionNum, status]);

  if (status === "checking") return <div style={{ padding: "2rem", textAlign: "center" }}>⏳ 상태 확인 중...</div>;

  if (status === "failed") return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>❌ 미션 {missionId} 실패</h1>
      <p>제한시간이 끝났습니다. 선생님께 가서 검사받으세요.</p>
    </div>
  );

  if (status === "done") return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>✅ 미션 {missionId} 완료</h1>
      <p>성공적으로 미션을 수행했습니다. 선생님께 가서 검사받으세요.</p>
    </div>
  );

  if (status === "active") return (
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
          <img src={`/images/mission${missionId}.png`} alt={`미션 ${missionId}`} style={{ maxWidth: "300px", margin: "1rem auto" }} />
          <p style={{ fontSize: "1.5rem" }}>⏳ 남은 시간: {timeLeft}초</p>
        </>
      )}
    </div>
  );

  return (
    <div style={{ padding: "2rem", textAlign: "center" }}>
      <h1>🎯 미션 {missionId}</h1>
      <button onClick={handleStart} style={{ fontSize: "1.5rem", padding: "1rem" }}>
        미션 확인
      </button>
    </div>
  );
};

export default MissionPage;
