import "./messageAttachments.css";

export const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB


export function validateAttachment(file) {

    if (!file) {
        return null;
    }

    if (file.size > MAX_FILE_SIZE) {
        return "File is too large. Maximum size is 10 MB.";
    }

    return null;

}


function formatSize(bytes) {

    if (!bytes) {
        return "";
    }

    if (bytes < 1024) {
        return `${bytes} B`;
    }

    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }

    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

}


// Shows the attachment inside a message bubble
export function MessageAttachment({ message }) {

    if (!message.attachment_url) {
        return null;
    }


    const isImage =
        message.attachment_type?.startsWith("image/");


    if (isImage) {

        return (

            <a
                href={message.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
            >

                <img
                    className="attachment-image"
                    src={message.attachment_url}
                    alt={
                        message.attachment_name ||
                        "attachment"
                    }
                />

            </a>

        );

    }


    return (

        <a
            className="attachment-file"
            href={message.attachment_url}
            target="_blank"
            rel="noopener noreferrer"
            download={message.attachment_name}
        >

            <span className="attachment-file-icon">
                📎
            </span>

            <span className="attachment-file-info">

                <strong>
                    {message.attachment_name}
                </strong>

                <small>
                    {formatSize(message.attachment_size)}
                </small>

            </span>

        </a>

    );

}


// Shows the selected file above the input before sending
export function SelectedFilePreview({ file, onClear }) {

    if (!file) {
        return null;
    }

    return (

        <div className="selected-file-preview">

            <span className="selected-file-name">
                📎 {file.name}
                {" "}
                <small>({formatSize(file.size)})</small>
            </span>

            <button
                type="button"
                onClick={onClear}
                title="Remove file"
            >
                ✕
            </button>

        </div>

    );

}