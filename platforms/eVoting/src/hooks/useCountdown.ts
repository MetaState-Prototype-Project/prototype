"use client";

import { useEffect, useState } from "react";

interface CountdownTime {
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    isExpired: boolean;
}

export function useCountdown(targetDate: string | null): CountdownTime {
    const [timeLeft, setTimeLeft] = useState<CountdownTime>({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
        isExpired: false,
    });

    useEffect(() => {
        if (!targetDate) {
            setTimeLeft({
                days: 0,
                hours: 0,
                minutes: 0,
                seconds: 0,
                isExpired: false,
            });
            return;
        }

        const calculateTimeLeft = () => {
            const now = new Date().getTime();
            const target = new Date(targetDate).getTime();
            const difference = target - now;

            if (difference <= 0) {
                setTimeLeft({
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                    isExpired: true,
                });
                return;
            }

            const days = Math.floor(difference / (1000 * 60 * 60 * 24));
            const hours = Math.floor(
                (difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
            );
            const minutes = Math.floor(
                (difference % (1000 * 60 * 60)) / (1000 * 60),
            );
            const seconds = Math.floor((difference % (1000 * 60)) / 1000);

            setTimeLeft({
                days,
                hours,
                minutes,
                seconds,
                isExpired: false,
            });
        };

        // Calculate immediately
        calculateTimeLeft();

        // Set up interval to update every second
        const timer = setInterval(calculateTimeLeft, 1000);

        // Cleanup interval on component unmount
        return () => clearInterval(timer);
    }, [targetDate]);

    return timeLeft;
}
