import Link from "next/link";

type ButtonProps = {
    className?: string;
    href?: string;
    onClick?: () => void;
    children: React.ReactNode;
    px?: string;
    white?: boolean;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
};

const ButtonSvg = ({ white }: { white?: boolean }) => (
    <>
        <svg
            className="absolute top-0 left-0"
            width="21"
            height="44"
            viewBox="0 0 21 44"
        >
            <path
                fill={white ? "#0E0C15" : "none"}
                stroke={white ? "#0E0C15" : "url(#btn-left)"}
                d="M21,43.00005 L8.11111,43.00005 C3.18375,43.00005 0,39.58105 0,35.36365 L0,8.63637 C0,4.41892 3.18375,1 8.11111,1 L21,1"
            />
            <defs>
                <linearGradient id="btn-left" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#89F9E8" />
                    <stop offset="100%" stopColor="#FACB7B" />
                </linearGradient>
            </defs>
        </svg>
        <svg
            className="absolute top-0 left-[20px] w-[calc(100%-40px)]"
            width="65"
            height="44"
            viewBox="0 0 65 44"
            preserveAspectRatio="none"
        >
            <rect
                fill={white ? "#0E0C15" : "url(#btn-top)"}
                width="65"
                height="44"
            />
            <defs>
                <linearGradient id="btn-top" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#89F9E8" />
                    <stop offset="100%" stopColor="#FACB7B" />
                </linearGradient>
            </defs>
        </svg>
        <svg
            className="absolute top-0 right-0"
            width="21"
            height="44"
            viewBox="0 0 21 44"
        >
            <path
                fill={white ? "#0E0C15" : "none"}
                stroke={white ? "#0E0C15" : "url(#btn-right)"}
                d="M0,43.00005 L5.028,43.00005 L12.24,43.00005 C17.1673,43.00005 21,39.58105 21,35.36365 L21,8.63637 C21,4.41892 17.1673,1 12.24,1 L5.028,1 L0,1"
            />
            <defs>
                <linearGradient id="btn-right" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#89F9E8" />
                    <stop offset="100%" stopColor="#FACB7B" />
                </linearGradient>
            </defs>
        </svg>
    </>
);

const Button = ({
    className,
    href,
    onClick,
    children,
    px,
    white,
    type = "button",
    disabled,
}: ButtonProps) => {
    const classes = `button relative inline-flex items-center justify-center h-11 transition-colors hover:text-color-1 ${
        px || "px-7"
    } ${white ? "text-n-8" : "text-n-1"} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${
        className || ""
    }`;

    const spanClasses = `relative z-10`;

    return href ? (
        href.startsWith("mailto:") ? (
            <a href={href} className={classes}>
                <span className={spanClasses}>{children}</span>
                <ButtonSvg white={white} />
            </a>
        ) : (
            <Link href={href} className={classes}>
                <span className={spanClasses}>{children}</span>
                <ButtonSvg white={white} />
            </Link>
        )
    ) : (
        <button className={classes} onClick={onClick} type={type} disabled={disabled}>
            <span className={spanClasses}>{children}</span>
            <ButtonSvg white={white} />
        </button>
    );
};

export default Button;