export class XMLSanitizerUtil {
    public static sanitize(input: string): string {
        return input
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('&', '&amp;')
            .replace("'", '&#39;')
            .replace("/", '&#x2F;')
    }

    // Escapes every special character of a text or attribute value, so DOMParser gives it back
    // unchanged (textContent / getAttribute).
    public static escape(input: string): string {
        return input
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')
    }
}