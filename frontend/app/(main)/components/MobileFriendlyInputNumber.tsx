'use client';

import React, { useEffect, useRef, useState } from 'react';
import { InputNumber as PrimeInputNumber, InputNumberProps } from 'primereact/inputnumber';
import { InputText } from 'primereact/inputtext';

type InputNumberValue = number | null;
type MobileFriendlyInputNumberProps = InputNumberProps & {
    /** Accept both `3,15` and `3.15`, including on desktop browsers. */
    allowBothDecimalSeparators?: boolean;
};

const assignRef = (ref: React.Ref<HTMLInputElement> | undefined, value: HTMLInputElement | null) => {
    if (!ref) return;
    if (typeof ref === 'function') ref(value);
    else (ref as React.MutableRefObject<HTMLInputElement | null>).current = value;
};

const numberFromText = (text: string, locale = 'pt-BR'): InputNumberValue => {
    const raw = String(text ?? '').replace(/[^\d,.-]/g, '');
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    const decimalIndex = Math.max(lastComma, lastDot);
    const decimal = decimalIndex >= 0 ? raw[decimalIndex] : null;
    const normalized = decimal
        ? `${raw.slice(0, decimalIndex).replace(/[.,]/g, '')}.${raw.slice(decimalIndex + 1).replace(/[.,]/g, '')}`
        : raw;
    if (!normalized || normalized === '-' || normalized === '.') return null;
    const value = Number(normalized);
    return Number.isFinite(value) ? value : null;
};

const textFromNumber = (value: InputNumberValue, locale = 'pt-BR') => {
    if (value === null || value === undefined) return '';
    const decimal = locale.toLowerCase().startsWith('pt') ? ',' : '.';
    return String(value).replace('.', decimal);
};

const formatValue = (value: InputNumberValue, props: InputNumberProps) => {
    if (value === null || value === undefined) return '';
    if (!props.format) return textFromNumber(value, props.locale);
    return new Intl.NumberFormat(props.locale || 'pt-BR', {
        style: props.mode === 'currency' ? 'currency' : 'decimal',
        currency: props.currency,
        currencyDisplay: props.currencyDisplay,
        useGrouping: props.useGrouping,
        minimumFractionDigits: props.minFractionDigits,
        maximumFractionDigits: props.maxFractionDigits,
    }).format(value);
};

const MobileFriendlyInputNumber: React.FC<MobileFriendlyInputNumberProps> = (props) => {
    const { allowBothDecimalSeparators, ...primeProps } = props;
    const [touchDevice, setTouchDevice] = useState<boolean | null>(null);
    const [focused, setFocused] = useState(false);
    const [text, setText] = useState(() => textFromNumber(props.value ?? null, props.locale));
    const inputRef = useRef<HTMLInputElement | null>(null);

    useEffect(() => {
        setTouchDevice(Boolean(
            navigator.maxTouchPoints > 0
            || 'ontouchstart' in window
            || window.matchMedia?.('(pointer: coarse)').matches
        ));
    }, []);

    useEffect(() => {
        if (!focused) setText(textFromNumber(props.value ?? null, props.locale));
    }, [props.value, props.locale, focused]);

    if (touchDevice !== true && !allowBothDecimalSeparators) return <PrimeInputNumber {...primeProps} />;

    const emitValue = (event: React.ChangeEvent<HTMLInputElement>, value: InputNumberValue) => {
        props.onChange?.({ originalEvent: event, value } as never);
        props.onValueChange?.({
            originalEvent: event,
            value,
            target: { name: props.name, id: props.id, value },
            stopPropagation: () => event.stopPropagation(),
            preventDefault: () => event.preventDefault(),
        } as never);
    };

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        const raw = event.target.value;
        const sanitized = raw.replace(/[^\d,.-]/g, '');
        setText(sanitized);
        emitValue(event, numberFromText(sanitized, props.locale));
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
        setFocused(true);
        props.onFocus?.(event);
        requestAnimationFrame(() => {
            if (document.activeElement === inputRef.current) inputRef.current?.select();
        });
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
        const parsed = numberFromText(text, props.locale);
        const bounded = parsed === null
            ? null
            : Math.min(props.max ?? parsed, Math.max(props.min ?? parsed, parsed));
        setText(formatValue(bounded, props));
        setFocused(false);
        if (bounded !== parsed) emitValue(event as never, bounded);
        props.onBlur?.(event);
    };

    const className = ['p-inputtext', 'p-inputnumber-input', props.inputClassName].filter(Boolean).join(' ');
    return (
        <span className={['p-inputnumber', 'p-component', props.className].filter(Boolean).join(' ')} style={props.style as React.CSSProperties}>
            <InputText
                ref={(element) => {
                    inputRef.current = element;
                    assignRef(props.inputRef, element);
                }}
                id={props.inputId}
                name={props.name}
                value={focused ? text : formatValue(numberFromText(text, props.locale), props)}
                className={className}
                style={props.inputStyle}
                placeholder={props.placeholder}
                disabled={props.disabled}
                readOnly={props.readOnly}
                required={props.required}
                autoFocus={props.autoFocus}
                tabIndex={props.tabIndex}
                inputMode={props.inputMode || 'decimal'}
                maxLength={props.maxLength}
                pattern={props.pattern}
                role="spinbutton"
                aria-label={props['aria-label']}
                aria-labelledby={props['aria-labelledby']}
                aria-valuemin={props.min ?? undefined}
                aria-valuemax={props.max ?? undefined}
                aria-valuenow={numberFromText(text, props.locale) ?? undefined}
                onChange={handleChange}
                onFocus={handleFocus}
                onBlur={handleBlur}
                onKeyDown={props.onKeyDown}
                onKeyUp={props.onKeyUp}
                onClick={props.onClick as React.MouseEventHandler<HTMLInputElement>}
            />
            {props.suffix ? <span className="p-inputnumber-suffix">{props.suffix}</span> : null}
        </span>
    );
};

export { MobileFriendlyInputNumber as InputNumber };
export default MobileFriendlyInputNumber;
