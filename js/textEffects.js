const TextEffects = {
    seededRandom(seed) {
        const x = Math.sin(seed * 9999) * 10000;
        return x - Math.floor(x);
    },

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    },

    rhythmWave(globalProgress, seed, waveIndex) {
        const freq1 = 1.7 + this.seededRandom(seed + waveIndex * 13 + 1) * 2.8;
        const freq2 = 3.1 + this.seededRandom(seed + waveIndex * 13 + 2) * 4.5;
        const freq3 = 5.3 + this.seededRandom(seed + waveIndex * 13 + 3) * 6.2;
        const phase1 = this.seededRandom(seed + waveIndex * 13 + 4) * Math.PI * 2;
        const phase2 = this.seededRandom(seed + waveIndex * 13 + 5) * Math.PI * 2;
        const phase3 = this.seededRandom(seed + waveIndex * 13 + 6) * Math.PI * 2;
        const amp1 = 0.55;
        const amp2 = 0.30;
        const amp3 = 0.15;
        const t = globalProgress * Math.PI * 2;
        return amp1 * Math.sin(freq1 * t + phase1)
             + amp2 * Math.sin(freq2 * t + phase2)
             + amp3 * Math.sin(freq3 * t + phase3);
    },

    linePositionEnvelope(lineProgress) {
        const startZone = 0.12;
        const endZone = 0.15;
        if (lineProgress < startZone) {
            const t = lineProgress / startZone;
            return 1.0 - t * 0.7;
        } else if (lineProgress > 1 - endZone) {
            const t = (lineProgress - (1 - endZone)) / endZone;
            return 0.3 + t * 0.7;
        } else {
            return 0.3;
        }
    },

    punctuationSpacingBoost(char) {
        const punctuation = ['。', '，', '、', '；', '：', '！', '？', '.', ',', ';', ':', '!', '?', '…', '—'];
        if (punctuation.includes(char)) return 1.5;
        const strongPunct = ['。', '！', '？', '.', '!', '?', '…'];
        if (strongPunct.includes(char)) return 1.8;
        const leftBracket = ['「', '『', '（', '(', '《', '<'];
        if (leftBracket.includes(char)) return 0.5;
        const rightBracket = ['」', '』', '）', ')', '》', '>'];
        if (rightBracket.includes(char)) return 1.3;
        return 1.0;
    },

    computeRhythmSpacing(char, charIndex, lineCharIndex, lineLength, globalCharIndex, seed, baseSpacing, rhythmIntensity) {
        if (rhythmIntensity <= 0 || lineLength === 0) return baseSpacing;
        const rNorm = rhythmIntensity / 100;
        const lineProgress = lineLength <= 1 ? 0.5 : lineCharIndex / (lineLength - 1);
        const globalProgress = Math.min(1.0, (globalCharIndex + 1) / 200);
        const wave = this.rhythmWave(globalProgress, seed, 0);
        const punctuationBoost = this.punctuationSpacingBoost(char);
        const lineStartBoost = lineProgress < 0.1 ? 1.0 + (0.1 - lineProgress) * 1.5 : 1.0;
        const lineEndBoost = lineProgress > 0.88 ? 1.0 - (lineProgress - 0.88) * 1.2 : 1.0;
        const rhythmFactor = 1.0 + wave * 0.55 * rNorm;
        const result = baseSpacing * rhythmFactor * punctuationBoost * lineStartBoost * lineEndBoost;
        return result;
    },

    computeRhythmOffset(charIndex, lineIndex, lineCharIndex, lineLength, globalCharIndex, seed, randomOffset, rhythmIntensity, prevOffset) {
        const rawOffset = this.randomOffsetForChar(charIndex, lineIndex, seed, randomOffset);
        if (rhythmIntensity <= 0) {
            return { x: rawOffset.x, y: rawOffset.y, rhythmX: rawOffset.x, rhythmY: rawOffset.y };
        }
        const rNorm = rhythmIntensity / 100;
        const lineProgress = lineLength <= 1 ? 0.5 : lineCharIndex / (lineLength - 1);
        const globalProgress = Math.min(1.0, (globalCharIndex + 1) / 200);
        const envelope = this.linePositionEnvelope(lineProgress);
        const waveX = this.rhythmWave(globalProgress, seed, 1);
        const waveY = this.rhythmWave(globalProgress * 1.3 + 0.15, seed, 2);
        let rhythmX = waveX * randomOffset * 1.6 * (0.35 + envelope);
        let rhythmY = waveY * randomOffset * 1.8 * (0.35 + envelope);
        if (lineProgress < 0.15) {
            const t = lineProgress / 0.15;
            rhythmX *= t;
            rhythmY *= t * 0.5;
        }
        if (lineProgress > 0.85) {
            const t = (lineProgress - 0.85) / 0.15;
            rhythmX *= (1 - t * 0.7);
            rhythmY *= (1 - t * 0.8);
        }
        const smoothFactor = 0.6;
        if (prevOffset && lineCharIndex > 0) {
            rhythmX = rhythmX * (1 - smoothFactor) + (prevOffset.rhythmX || 0) * smoothFactor;
            rhythmY = rhythmY * (1 - smoothFactor) + (prevOffset.rhythmY || 0) * smoothFactor;
        }
        const blendX = rawOffset.x * (1 - rNorm) + rhythmX * rNorm;
        const blendY = rawOffset.y * (1 - rNorm) + rhythmY * rNorm;
        return { x: blendX, y: blendY, rhythmX, rhythmY };
    },

    computeRhythmRotation(charIndex, lineIndex, lineCharIndex, lineLength, globalCharIndex, seed, rhythmIntensity, prevRotation) {
        const rawRotation = this.randomRotationForChar(charIndex, lineIndex, seed);
        if (rhythmIntensity <= 0) {
            return { final: rawRotation, rhythmRot: rawRotation };
        }
        const rNorm = rhythmIntensity / 100;
        const lineProgress = lineLength <= 1 ? 0.5 : lineCharIndex / (lineLength - 1);
        const globalProgress = Math.min(1.0, (globalCharIndex + 1) / 200);
        const wave = this.rhythmWave(globalProgress * 0.9 + 0.08, seed, 3);
        const envelope = this.linePositionEnvelope(lineProgress);
        let rhythmRot = wave * 6.0 * (0.35 + envelope * 0.9);
        const driftSeed = seed + Math.floor(globalCharIndex / 5) * 31;
        const drift = (this.seededRandom(driftSeed) - 0.5) * 3.5;
        rhythmRot += drift * rNorm * 0.5;
        if (lineProgress < 0.12) {
            const t = lineProgress / 0.12;
            rhythmRot *= t * t;
        }
        if (lineProgress > 0.88) {
            const t = (lineProgress - 0.88) / 0.12;
            rhythmRot *= (1 - t * 0.8);
        }
        if (prevRotation !== undefined && prevRotation.rhythmRot !== undefined && lineCharIndex > 0) {
            const maxDelta = 2.8 * rNorm + 1.0;
            const diff = rhythmRot - prevRotation.rhythmRot;
            if (Math.abs(diff) > maxDelta) {
                rhythmRot = prevRotation.rhythmRot + Math.sign(diff) * maxDelta;
            }
        }
        return {
            final: rawRotation * (1 - rNorm) + rhythmRot * rNorm,
            rhythmRot
        };
    },

    randomOffsetForChar(charIndex, lineIndex, seed, randomOffset) {
        const offsetSeed = seed + charIndex * 1000 + lineIndex * 10000;
        const offsetX = (this.seededRandom(offsetSeed) - 0.5) * 2 * randomOffset;
        const offsetY = (this.seededRandom(offsetSeed + 100) - 0.5) * 2 * randomOffset;
        return { x: offsetX, y: offsetY };
    },

    randomRotationForChar(charIndex, lineIndex, seed) {
        const rotationSeed = seed + charIndex * 2000 + lineIndex * 20000;
        return (this.seededRandom(rotationSeed) - 0.5) * 2.5;
    },

    drawChar(ctx, char, x, y, options) {
        const { charIndex, lineIndex, lineCharIndex, lineLength, globalCharIndex,
                seed, fontSize, fontFamily, weight, slantAngle, inkColor, inkDensity,
                randomOffset, strokeNoise, rhythmIntensity, prevRhythmState } = options;
        
        const effectiveRhythm = rhythmIntensity !== undefined ? rhythmIntensity : 0;
        
        const offset = this.computeRhythmOffset(
            charIndex, lineIndex, lineCharIndex, lineLength,
            globalCharIndex, seed, randomOffset, effectiveRhythm,
            prevRhythmState ? prevRhythmState.offset : null
        );
        
        const rotationResult = this.computeRhythmRotation(
            charIndex, lineIndex, lineCharIndex, lineLength,
            globalCharIndex, seed, effectiveRhythm,
            prevRhythmState ? prevRhythmState.rotation : undefined
        );
        const rotation = rotationResult.final;
        const slantRad = (slantAngle + rotation) * Math.PI / 180;
        
        const inkRgb = this.hexToRgb(inkColor);
        const baseAlpha = 0.45 + (inkDensity / 100) * 0.55;
        const noiseLevel = strokeNoise / 100;
        
        ctx.save();
        ctx.translate(x + offset.x, y + offset.y);
        ctx.transform(1, 0, Math.tan(slantRad), 1, 0, 0);
        
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        ctx.textBaseline = 'top';
        
        ctx.globalCompositeOperation = 'source-over';
        
        for (let layer = 0; layer < 3; layer++) {
            const layerSeed = seed + charIndex * 100 + layer * 50 + lineIndex * 500;
            const layerAlpha = baseAlpha * (0.55 + layer * 0.25);
            const layerOffsetX = (this.seededRandom(layerSeed) - 0.5) * noiseLevel * 2.5;
            const layerOffsetY = (this.seededRandom(layerSeed + 1) - 0.5) * noiseLevel * 2.5;
            const scaleX = 1 + (this.seededRandom(layerSeed + 2) - 0.5) * 0.03;
            const scaleY = 1 + (this.seededRandom(layerSeed + 3) - 0.5) * 0.03;
            
            ctx.save();
            ctx.translate(layerOffsetX, layerOffsetY);
            ctx.scale(scaleX, scaleY);
            
            ctx.fillStyle = `rgba(${inkRgb.r}, ${inkRgb.g}, ${inkRgb.b}, ${layerAlpha})`;
            ctx.fillText(char, 0, 0);
            
            ctx.restore();
        }
        
        if (noiseLevel > 0.15) {
            this.addInkSplatter(ctx, char, charIndex, lineIndex, seed, noiseLevel, inkRgb, fontSize);
        }
        
        if (noiseLevel > 0.25) {
            this.addStrokeTexture(ctx, char, charIndex, lineIndex, seed, noiseLevel, fontSize);
        }
        
        ctx.restore();
        
        return {
            offset: { rhythmX: offset.rhythmX, rhythmY: offset.rhythmY },
            rotation: { rhythmRot: rotationResult.rhythmRot }
        };
    },

    addInkSplatter(ctx, char, charIndex, lineIndex, seed, noiseLevel, inkRgb, fontSize) {
        ctx.save();
        ctx.font = `${fontSize}px serif`;
        const metrics = ctx.measureText(char);
        const width = metrics.width;
        const height = fontSize;
        
        const dotCount = Math.floor(noiseLevel * 25);
        
        for (let i = 0; i < dotCount; i++) {
            const dotSeed = seed + charIndex * 1000 + lineIndex * 5000 + i * 17;
            const dx = this.seededRandom(dotSeed) * (width + height * 0.4) - height * 0.2;
            const dy = this.seededRandom(dotSeed + 1) * (height + height * 0.4) - height * 0.2;
            const size = this.seededRandom(dotSeed + 2) * 1.8 + 0.3;
            const alpha = this.seededRandom(dotSeed + 3) * noiseLevel * 0.35;
            
            ctx.fillStyle = `rgba(${inkRgb.r}, ${inkRgb.g}, ${inkRgb.b}, ${alpha})`;
            ctx.beginPath();
            ctx.arc(dx, dy, size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.restore();
    },

    addStrokeTexture(ctx, char, charIndex, lineIndex, seed, noiseLevel, fontSize) {
        ctx.save();
        ctx.globalCompositeOperation = 'destination-out';
        
        const holeCount = Math.floor(noiseLevel * 40);
        for (let i = 0; i < holeCount; i++) {
            const holeSeed = seed + charIndex * 2000 + lineIndex * 8000 + i * 23;
            const dx = this.seededRandom(holeSeed) * fontSize * 1.5;
            const dy = this.seededRandom(holeSeed + 1) * fontSize * 1.2;
            const size = this.seededRandom(holeSeed + 2) * 1.2 + 0.3;
            
            ctx.fillStyle = `rgba(0, 0, 0, ${this.seededRandom(holeSeed + 3) * 0.15 + 0.05})`;
            ctx.beginPath();
            ctx.arc(dx, dy, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    },

    measureText(ctx, text, fontSize, fontFamily, weight, charSpacing) {
        ctx.font = `${weight} ${fontSize}px ${fontFamily}`;
        let width = 0;
        for (let i = 0; i < text.length; i++) {
            width += ctx.measureText(text[i]).width + charSpacing;
        }
        return width;
    }
};

if (typeof window !== 'undefined') {
    window.TextEffects = TextEffects;
}
