/*! *****************************************************************************
Copyright (c) Microsoft Corporation. All rights reserved.
Licensed under the Apache License, Version 2.0 (the "License"); you may not use
this file except in compliance with the License. You may obtain a copy of the
License at http://www.apache.org/licenses/LICENSE-2.0

THIS CODE IS PROVIDED ON AN *AS IS* BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
KIND, EITHER EXPRESS OR IMPLIED, INCLUDING WITHOUT LIMITATION ANY IMPLIED
WARRANTIES OR CONDITIONS OF TITLE, FITNESS FOR A PARTICULAR PURPOSE,
MERCHANTABLITY OR NON-INFRINGEMENT.

See the Apache Version 2.0 License for specific language governing permissions
and limitations under the License.
***************************************************************************** */


/// <reference no-default-lib="true"/>

/////////////////////////////
/// Worker APIs
/////////////////////////////

interface AddEventListenerOptions extends EventListenerOptions {
    once?: boolean;
    passive?: boolean;
    signal?: AbortSignal;
}

interface AesCbcParams extends Algorithm {
    iv: BufferSource;
}

interface AesCtrParams extends Algorithm {
    counter: BufferSource;
    length: number;
}

interface AesDerivedKeyParams extends Algorithm {
    length: number;
}

interface AesGcmParams extends Algorithm {
    additionalData?: BufferSource;
    iv: BufferSource;
    tagLength?: number;
}

interface AesKeyAlgorithm extends KeyAlgorithm {
    length: number;
}

interface AesKeyGenParams extends Algorithm {
    length: number;
}

interface Algorithm {
    name: string;
}

interface AudioConfiguration {
    bitrate?: number;
    channels?: string;
    contentType: string;
    samplerate?: number;
    spatialRendering?: boolean;
}

interface AudioDataCopyToOptions {
    format?: AudioSampleFormat;
    frameCount?: number;
    frameOffset?: number;
    planeIndex: number;
}

interface AudioDataInit {
    data: BufferSource;
    format: AudioSampleFormat;
    numberOfChannels: number;
    numberOfFrames: number;
    sampleRate: number;
    timestamp: number;
    transfer?: ArrayBuffer[];
}

interface AudioDecoderConfig {
    codec: string;
    description?: BufferSource;
    numberOfChannels: number;
    sampleRate: number;
}

interface AudioDecoderInit {
    error: WebCodecsErrorCallback;
    output: AudioDataOutputCallback;
}

interface AudioDecoderSupport {
    config?: AudioDecoderConfig;
    supported?: boolean;
}

interface AudioEncoderConfig {
    bitrate?: number;
    bitrateMode?: BitrateMode;
    codec: string;
    numberOfChannels: number;
    opus?: OpusEncoderConfig;
    sampleRate: number;
}

interface AudioEncoderInit {
    error: WebCodecsErrorCallback;
    output: EncodedAudioChunkOutputCallback;
}

interface AudioEncoderSupport {
    config?: AudioEncoderConfig;
    supported?: boolean;
}

interface AvcEncoderConfig {
    format?: AvcBitstreamFormat;
}

interface BlobPropertyBag {
    endings?: EndingType;
    type?: string;
}

interface CSSMatrixComponentOptions {
    is2D?: boolean;
}

interface CSSNumericType {
    angle?: number;
    flex?: number;
    frequency?: number;
    length?: number;
    percent?: number;
    percentHint?: CSSNumericBaseType;
    resolution?: number;
    time?: number;
}

interface CacheQueryOptions {
    ignoreMethod?: boolean;
    ignoreSearch?: boolean;
    ignoreVary?: boolean;
}

interface ClientQueryOptions {
    includeUncontrolled?: boolean;
    type?: ClientTypes;
}

interface CloseEventInit extends EventInit {
    code?: number;
    reason?: string;
    wasClean?: boolean;
}

interface CryptoKeyPair {
    privateKey: CryptoKey;
    publicKey: CryptoKey;
}

interface CustomEventInit<T = any> extends EventInit {
    detail?: T;
}

interface DOMMatrix2DInit {
    a?: number;
    b?: number;
    c?: number;
    d?: number;
    e?: number;
    f?: number;
    m11?: number;
    m12?: number;
    m21?: number;
    m22?: number;
    m41?: number;
    m42?: number;
}

interface DOMMatrixInit extends DOMMatrix2DInit {
    is2D?: boolean;
    m13?: number;
    m14?: number;
    m23?: number;
    m24?: number;
    m31?: number;
    m32?: number;
    m33?: number;
    m34?: number;
    m43?: number;
    m44?: number;
}

interface DOMPointInit {
    w?: number;
    x?: number;
    y?: number;
    z?: number;
}

interface DOMQuadInit {
    p1?: DOMPointInit;
    p2?: DOMPointInit;
    p3?: DOMPointInit;
    p4?: DOMPointInit;
}

interface DOMRectInit {
    height?: number;
    width?: number;
    x?: number;
    y?: number;
}

interface EcKeyGenParams extends Algorithm {
    namedCurve: NamedCurve;
}

interface EcKeyImportParams extends Algorithm {
    namedCurve: NamedCurve;
}

interface EcdhKeyDeriveParams extends Algorithm {
    public: CryptoKey;
}

interface EcdsaParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
}

interface EncodedAudioChunkInit {
    data: AllowSharedBufferSource;
    duration?: number;
    timestamp: number;
    transfer?: ArrayBuffer[];
    type: EncodedAudioChunkType;
}

interface EncodedAudioChunkMetadata {
    decoderConfig?: AudioDecoderConfig;
}

interface EncodedVideoChunkInit {
    data: AllowSharedBufferSource;
    duration?: number;
    timestamp: number;
    type: EncodedVideoChunkType;
}

interface EncodedVideoChunkMetadata {
    decoderConfig?: VideoDecoderConfig;
}

interface ErrorEventInit extends EventInit {
    colno?: number;
    error?: any;
    filename?: string;
    lineno?: number;
    message?: string;
}

interface EventInit {
    bubbles?: boolean;
    cancelable?: boolean;
    composed?: boolean;
}

interface EventListenerOptions {
    capture?: boolean;
}

interface EventSourceInit {
    withCredentials?: boolean;
}

interface ExtendableEventInit extends EventInit {
}

interface ExtendableMessageEventInit extends ExtendableEventInit {
    data?: any;
    lastEventId?: string;
    origin?: string;
    ports?: MessagePort[];
    source?: Client | ServiceWorker | MessagePort | null;
}

interface FetchEventInit extends ExtendableEventInit {
    clientId?: string;
    handled?: Promise<void>;
    preloadResponse?: Promise<any>;
    replacesClientId?: string;
    request: Request;
    resultingClientId?: string;
}

interface FilePropertyBag extends BlobPropertyBag {
    lastModified?: number;
}

interface FileSystemCreateWritableOptions {
    keepExistingData?: boolean;
}

interface FileSystemGetDirectoryOptions {
    create?: boolean;
}

interface FileSystemGetFileOptions {
    create?: boolean;
}

interface FileSystemReadWriteOptions {
    at?: number;
}

interface FileSystemRemoveOptions {
    recursive?: boolean;
}

interface FontFaceDescriptors {
    ascentOverride?: string;
    descentOverride?: string;
    display?: FontDisplay;
    featureSettings?: string;
    lineGapOverride?: string;
    stretch?: string;
    style?: string;
    unicodeRange?: string;
    weight?: string;
}

interface FontFaceSetLoadEventInit extends EventInit {
    fontfaces?: FontFace[];
}

interface GetNotificationOptions {
    tag?: string;
}

interface HkdfParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
    info: BufferSource;
    salt: BufferSource;
}

interface HmacImportParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
    length?: number;
}

interface HmacKeyGenParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
    length?: number;
}

interface IDBDatabaseInfo {
    name?: string;
    version?: number;
}

interface IDBIndexParameters {
    multiEntry?: boolean;
    unique?: boolean;
}

interface IDBObjectStoreParameters {
    autoIncrement?: boolean;
    keyPath?: string | string[] | null;
}

interface IDBTransactionOptions {
    durability?: IDBTransactionDurability;
}

interface IDBVersionChangeEventInit extends EventInit {
    newVersion?: number | null;
    oldVersion?: number;
}

interface ImageBitmapOptions {
    colorSpaceConversion?: ColorSpaceConversion;
    imageOrientation?: ImageOrientation;
    premultiplyAlpha?: PremultiplyAlpha;
    resizeHeight?: number;
    resizeQuality?: ResizeQuality;
    resizeWidth?: number;
}

interface ImageBitmapRenderingContextSettings {
    alpha?: boolean;
}

interface ImageDataSettings {
    colorSpace?: PredefinedColorSpace;
}

interface ImageDecodeOptions {
    completeFramesOnly?: boolean;
    frameIndex?: number;
}

interface ImageDecodeResult {
    complete: boolean;
    image: VideoFrame;
}

interface ImageDecoderInit {
    colorSpaceConversion?: ColorSpaceConversion;
    data: ImageBufferSource;
    desiredHeight?: number;
    desiredWidth?: number;
    preferAnimation?: boolean;
    transfer?: ArrayBuffer[];
    type: string;
}

interface ImageEncodeOptions {
    quality?: number;
    type?: string;
}

interface JsonWebKey {
    alg?: string;
    crv?: string;
    d?: string;
    dp?: string;
    dq?: string;
    e?: string;
    ext?: boolean;
    k?: string;
    key_ops?: string[];
    kty?: string;
    n?: string;
    oth?: RsaOtherPrimesInfo[];
    p?: string;
    q?: string;
    qi?: string;
    use?: string;
    x?: string;
    y?: string;
}

interface KeyAlgorithm {
    name: string;
}

interface LockInfo {
    clientId?: string;
    mode?: LockMode;
    name?: string;
}

interface LockManagerSnapshot {
    held?: LockInfo[];
    pending?: LockInfo[];
}

interface LockOptions {
    ifAvailable?: boolean;
    mode?: LockMode;
    signal?: AbortSignal;
    steal?: boolean;
}

interface MediaCapabilitiesDecodingInfo extends MediaCapabilitiesInfo {
    configuration?: MediaDecodingConfiguration;
}

interface MediaCapabilitiesEncodingInfo extends MediaCapabilitiesInfo {
    configuration?: MediaEncodingConfiguration;
}

interface MediaCapabilitiesInfo {
    powerEfficient: boolean;
    smooth: boolean;
    supported: boolean;
}

interface MediaConfiguration {
    audio?: AudioConfiguration;
    video?: VideoConfiguration;
}

interface MediaDecodingConfiguration extends MediaConfiguration {
    type: MediaDecodingType;
}

interface MediaEncodingConfiguration extends MediaConfiguration {
    type: MediaEncodingType;
}

interface MediaStreamTrackProcessorInit {
    maxBufferSize?: number;
}

interface MessageEventInit<T = any> extends EventInit {
    data?: T;
    lastEventId?: string;
    origin?: string;
    ports?: MessagePort[];
    source?: MessageEventSource | null;
}

interface MultiCacheQueryOptions extends CacheQueryOptions {
    cacheName?: string;
}

interface NavigationPreloadState {
    enabled?: boolean;
    headerValue?: string;
}

interface NotificationEventInit extends ExtendableEventInit {
    action?: string;
    notification: Notification;
}

interface NotificationOptions {
    badge?: string;
    body?: string;
    data?: any;
    dir?: NotificationDirection;
    icon?: string;
    lang?: string;
    requireInteraction?: boolean;
    silent?: boolean | null;
    tag?: string;
}

interface OpusEncoderConfig {
    complexity?: number;
    format?: OpusBitstreamFormat;
    frameDuration?: number;
    packetlossperc?: number;
    usedtx?: boolean;
    useinbandfec?: boolean;
}

interface Pbkdf2Params extends Algorithm {
    hash: HashAlgorithmIdentifier;
    iterations: number;
    salt: BufferSource;
}

interface PerformanceMarkOptions {
    detail?: any;
    startTime?: DOMHighResTimeStamp;
}

interface PerformanceMeasureOptions {
    detail?: any;
    duration?: DOMHighResTimeStamp;
    end?: string | DOMHighResTimeStamp;
    start?: string | DOMHighResTimeStamp;
}

interface PerformanceObserverInit {
    buffered?: boolean;
    entryTypes?: string[];
    type?: string;
}

interface PermissionDescriptor {
    name: PermissionName;
}

interface PlaneLayout {
    offset: number;
    stride: number;
}

interface ProgressEventInit extends EventInit {
    lengthComputable?: boolean;
    loaded?: number;
    total?: number;
}

interface PromiseRejectionEventInit extends EventInit {
    promise: Promise<any>;
    reason?: any;
}

interface PushEventInit extends ExtendableEventInit {
    data?: PushMessageDataInit;
}

interface PushSubscriptionJSON {
    endpoint?: string;
    expirationTime?: EpochTimeStamp | null;
    keys?: Record<string, string>;
}

interface PushSubscriptionOptionsInit {
    applicationServerKey?: BufferSource | string | null;
    userVisibleOnly?: boolean;
}

interface QueuingStrategy<T = any> {
    highWaterMark?: number;
    size?: QueuingStrategySize<T>;
}

interface QueuingStrategyInit {
    /**
     * Creates a new ByteLengthQueuingStrategy with the provided high water mark.
     *
     * Note that the provided high water mark will not be validated ahead of time. Instead, if it is negative, NaN, or not a number, the resulting ByteLengthQueuingStrategy will cause the corresponding stream constructor to throw.
     */
    highWaterMark: number;
}

interface RTCEncodedAudioFrameMetadata {
    contributingSources?: number[];
    payloadType?: number;
    sequenceNumber?: number;
    synchronizationSource?: number;
}

interface RTCEncodedVideoFrameMetadata {
    contributingSources?: number[];
    dependencies?: number[];
    frameId?: number;
    height?: number;
    payloadType?: number;
    spatialIndex?: number;
    synchronizationSource?: number;
    temporalIndex?: number;
    timestamp?: number;
    width?: number;
}

interface ReadableStreamGetReaderOptions {
    /**
     * Creates a ReadableStreamBYOBReader and locks the stream to the new reader.
     *
     * This call behaves the same way as the no-argument variant, except that it only works on readable byte streams, i.e. streams which were constructed specifically with the ability to handle "bring your own buffer" reading. The returned BYOB reader provides the ability to directly read individual chunks from the stream via its read() method, into developer-supplied buffers, allowing more precise control over allocation.
     */
    mode?: ReadableStreamReaderMode;
}

interface ReadableStreamIteratorOptions {
    /**
     * Asynchronously iterates over the chunks in the stream's internal queue.
     *
     * Asynchronously iterating over the stream will lock it, preventing any other consumer from acquiring a reader. The lock will be released if the async iterator's return() method is called, e.g. by breaking out of the loop.
     *
     * By default, calling the async iterator's return() method will also cancel the stream. To prevent this, use the stream's values() method, passing true for the preventCancel option.
     */
    preventCancel?: boolean;
}

interface ReadableStreamReadDoneResult<T> {
    done: true;
    value?: T;
}

interface ReadableStreamReadValueResult<T> {
    done: false;
    value: T;
}

interface ReadableWritablePair<R = any, W = any> {
    readable: ReadableStream<R>;
    /**
     * Provides a convenient, chainable way of piping this readable stream through a transform stream (or any other { writable, readable } pair). It simply pipes the stream into the writable side of the supplied pair, and returns the readable side for further use.
     *
     * Piping a stream will lock it for the duration of the pipe, preventing any other consumer from acquiring a reader.
     */
    writable: WritableStream<W>;
}

interface RegistrationOptions {
    scope?: string;
    type?: WorkerType;
    updateViaCache?: ServiceWorkerUpdateViaCache;
}

interface ReportingObserverOptions {
    buffered?: boolean;
    types?: string[];
}

interface RequestInit {
    /** A BodyInit object or null to set request's body. */
    body?: BodyInit | null;
    /** A string indicating how the request will interact with the browser's cache to set request's cache. */
    cache?: RequestCache;
    /** A string indicating whether credentials will be sent with the request always, never, or only when sent to a same-origin URL. Sets request's credentials. */
    credentials?: RequestCredentials;
    /** A Headers object, an object literal, or an array of two-item arrays to set request's headers. */
    headers?: HeadersInit;
    /** A cryptographic hash of the resource to be fetched by request. Sets request's integrity. */
    integrity?: string;
    /** A boolean to set request's keepalive. */
    keepalive?: boolean;
    /** A string to set request's method. */
    method?: string;
    /** A string to indicate whether the request will use CORS, or will be restricted to same-origin URLs. Sets request's mode. */
    mode?: RequestMode;
    priority?: RequestPriority;
    /** A string indicating whether request follows redirects, results in an error upon encountering a redirect, or returns the redirect (in an opaque fashion). Sets request's redirect. */
    redirect?: RequestRedirect;
    /** A string whose value is a same-origin URL, "about:client", or the empty string, to set request's referrer. */
    referrer?: string;
    /** A referrer policy to set request's referrerPolicy. */
    referrerPolicy?: ReferrerPolicy;
    /** An AbortSignal to set request's signal. */
    signal?: AbortSignal | null;
    /** Can only be null. Used to disassociate request from any Window. */
    window?: null;
}

interface ResponseInit {
    headers?: HeadersInit;
    status?: number;
    statusText?: string;
}

interface RsaHashedImportParams extends Algorithm {
    hash: HashAlgorithmIdentifier;
}

interface RsaHashedKeyGenParams extends RsaKeyGenParams {
    hash: HashAlgorithmIdentifier;
}

interface RsaKeyGenParams extends Algorithm {
    modulusLength: number;
    publicExponent: BigInteger;
}

interface RsaOaepParams extends Algorithm {
    label?: BufferSource;
}

interface RsaOtherPrimesInfo {
    d?: string;
    r?: string;
    t?: string;
}

interface RsaPssParams extends Algorithm {
    saltLength: number;
}

interface SecurityPolicyViolationEventInit extends EventInit {
    blockedURI?: string;
    columnNumber?: number;
    disposition?: SecurityPolicyViolationEventDisposition;
    documentURI?: string;
    effectiveDirective?: string;
    lineNumber?: number;
    originalPolicy?: string;
    referrer?: string;
    sample?: string;
    sourceFile?: string;
    statusCode?: number;
    violatedDirective?: string;
}

interface StorageEstimate {
    quota?: number;
    usage?: number;
}

interface StreamPipeOptions {
    preventAbort?: boolean;
    preventCancel?: boolean;
    /**
     * Pipes this readable stream to a given writable stream destination. The way in which the piping process behaves under various error conditions can be customized with a number of passed options. It returns a promise that fulfills when the piping process completes successfully, or rejects if any errors were encountered.
     *
     * Piping a stream will lock it for the duration of the pipe, preventing any other consumer from acquiring a reader.
     *
     * Errors and closures of the source and destination streams propagate as follows:
     *
     * An error in this source readable stream will abort destination, unless preventAbort is truthy. The returned promise will be rejected with the source's error, or with any error that occurs during aborting the destination.
     *
     * An error in destination will cancel this source readable stream, unless preventCancel is truthy. The returned promise will be rejected with the destination's error, or with any error that occurs during canceling the source.
     *
     * When this source readable stream closes, destination will be closed, unless preventClose is truthy. The returned promise will be fulfilled once this process completes, unless an error is encountered while closing the destination, in which case it will be rejected with that error.
     *
     * If destination starts out closed or closing, this source readable stream will be canceled, unless preventCancel is true. The returned promise will be rejected with an error indicating piping to a closed stream failed, or with any error that occurs during canceling the source.
     *
     * The signal option can be set to an AbortSignal to allow aborting an ongoing pipe operation via the corresponding AbortController. In this case, this source readable stream will be canceled, and destination aborted, unless the respective options preventCancel or preventAbort are set.
     */
    preventClose?: boolean;
    signal?: AbortSignal;
}

interface StructuredSerializeOptions {
    transfer?: Transferable[];
}

interface TextDecodeOptions {
    stream?: boolean;
}

interface TextDecoderOptions {
    fatal?: boolean;
    ignoreBOM?: boolean;
}

interface TextEncoderEncodeIntoResult {
    read: number;
    written: number;
}

interface Transformer<I = any, O = any> {
    flush?: TransformerFlushCallback<O>;
    readableType?: undefined;
    start?: TransformerStartCallback<O>;
    transform?: TransformerTransformCallback<I, O>;
    writableType?: undefined;
}

interface UnderlyingByteSource {
    autoAllocateChunkSize?: number;
    cancel?: UnderlyingSourceCancelCallback;
    pull?: (controller: ReadableByteStreamController) => void | PromiseLike<void>;
    start?: (controller: ReadableByteStreamController) => any;
    type: "bytes";
}

interface UnderlyingDefaultSource<R = any> {
    cancel?: UnderlyingSourceCancelCallback;
    pull?: (controller: ReadableStreamDefaultController<R>) => void | PromiseLike<void>;
    start?: (controller: ReadableStreamDefaultController<R>) => any;
    type?: undefined;
}

interface UnderlyingSink<W = any> {
    abort?: UnderlyingSinkAbortCallback;
    close?: UnderlyingSinkCloseCallback;
    start?: UnderlyingSinkStartCallback;
    type?: undefined;
    write?: UnderlyingSinkWriteCallback<W>;
}

interface UnderlyingSource<R = any> {
    autoAllocateChunkSize?: number;
    cancel?: UnderlyingSourceCancelCallback;
    pull?: UnderlyingSourcePullCallback<R>;
    start?: UnderlyingSourceStartCallback<R>;
    type?: ReadableStreamType;
}

interface VideoColorSpaceInit {
    fullRange?: boolean | null;
    matrix?: VideoMatrixCoefficients | null;
    primaries?: VideoColorPrimaries | null;
    transfer?: VideoTransferCharacteristics | null;
}

interface VideoConfiguration {
    bitrate: number;
    colorGamut?: ColorGamut;
    contentType: string;
    framerate: number;
    hasAlphaChannel?: boolean;
    hdrMetadataType?: HdrMetadataType;
    height: number;
    scalabilityMode?: string;
    transferFunction?: TransferFunction;
    width: number;
}

interface VideoDecoderConfig {
    codec: string;
    codedHeight?: number;
    codedWidth?: number;
    colorSpace?: VideoColorSpaceInit;
    description?: AllowSharedBufferSource;
    displayAspectHeight?: number;
    displayAspectWidth?: number;
    hardwareAcceleration?: HardwareAcceleration;
    optimizeForLatency?: boolean;
}

interface VideoDecoderInit {
    error: WebCodecsErrorCallback;
    output: VideoFrameOutputCallback;
}

interface VideoDecoderSupport {
    config?: VideoDecoderConfig;
    supported?: boolean;
}

interface VideoEncoderConfig {
    alpha?: AlphaOption;
    avc?: AvcEncoderConfig;
    bitrate?: number;
    bitrateMode?: VideoEncoderBitrateMode;
    codec: string;
    contentHint?: string;
    displayHeight?: number;
    displayWidth?: number;
    framerate?: number;
    hardwareAcceleration?: HardwareAcceleration;
    height: number;
    latencyMode?: LatencyMode;
    scalabilityMode?: string;
    width: number;
}

interface VideoEncoderEncodeOptions {
    avc?: VideoEncoderEncodeOptionsForAvc;
    keyFrame?: boolean;
}

interface VideoEncoderEncodeOptionsForAvc {
    quantizer?: number | null;
}

interface VideoEncoderInit {
    error: WebCodecsErrorCallback;
    output: EncodedVideoChunkOutputCallback;
}

interface VideoEncoderSupport {
    config?: VideoEncoderConfig;
    supported?: boolean;
}

interface VideoFrameBufferInit {
    codedHeight: number;
    codedWidth: number;
    colorSpace?: VideoColorSpaceInit;
    displayHeight?: number;
    displayWidth?: number;
    duration?: number;
    format: VideoPixelFormat;
    layout?: PlaneLayout[];
    timestamp: number;
    visibleRect?: DOMRectInit;
}

interface VideoFrameCopyToOptions {
    colorSpace?: PredefinedColorSpace;
    format?: VideoPixelFormat;
    layout?: PlaneLayout[];
    rect?: DOMRectInit;
}

interface VideoFrameInit {
    alpha?: AlphaOption;
    displayHeight?: number;
    displayWidth?: number;
    duration?: number;
    timestamp?: number;
    visibleRect?: DOMRectInit;
}

interface WebGLContextAttributes {
    alpha?: boolean;
    antialias?: boolean;
    depth?: boolean;
    desynchronized?: boolean;
    failIfMajorPerformanceCaveat?: boolean;
    powerPreference?: WebGLPowerPreference;
    premultipliedAlpha?: boolean;
    preserveDrawingBuffer?: boolean;
    stencil?: boolean;
}

interface WebGLContextEventInit extends EventInit {
    statusMessage?: string;
}

interface WebTransportCloseInfo {
    closeCode?: number;
    reason?: string;
}

interface WebTransportErrorOptions {
    source?: WebTransportErrorSource;
    streamErrorCode?: number | null;
}

interface WebTransportHash {
    algorithm?: string;
    value?: BufferSource;
}

interface WebTransportOptions {
    allowPooling?: boolean;
    congestionControl?: WebTransportCongestionControl;
    requireUnreliable?: boolean;
    serverCertificateHashes?: WebTransportHash[];
}

interface WebTransportSendStreamOptions {
    sendOrder?: number;
}

interface WorkerOptions {
    credentials?: RequestCredentials;
    name?: string;
    type?: WorkerType;
}

interface WriteParams {
    data?: BufferSource | Blob | string | null;
    position?: number | null;
    size?: number | null;
    type: WriteCommandType;
}

/**
 * The ANGLE_instanced_arrays extension is part of the WebGL API and allows to draw the same object, or groups of similar objects multiple times, if they share the same vertex data, primitive count and type.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ANGLE_instanced_arrays)
 */
interface ANGLE_instanced_arrays {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ANGLE_instanced_arrays/drawArraysInstancedANGLE) */
    drawArraysInstancedANGLE(mode: GLenum, first: GLint, count: GLsizei, primcount: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ANGLE_instanced_arrays/drawElementsInstancedANGLE) */
    drawElementsInstancedANGLE(mode: GLenum, count: GLsizei, type: GLenum, offset: GLintptr, primcount: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ANGLE_instanced_arrays/vertexAttribDivisorANGLE) */
    vertexAttribDivisorANGLE(index: GLuint, divisor: GLuint): void;
    readonly VERTEX_ATTRIB_ARRAY_DIVISOR_ANGLE: 0x88FE;
}

/**
 * A controller object that allows you to abort one or more DOM requests as and when desired.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController)
 */
interface AbortController {
    /**
     * Returns the AbortSignal object associated with this object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/signal)
     */
    readonly signal: AbortSignal;
    /**
     * Invoking this method will set this object's AbortSignal's aborted flag and signal to any observers that the associated activity is to be aborted.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortController/abort)
     */
    abort(reason?: any): void;
}

declare var AbortController: {
    prototype: AbortController;
    new(): AbortController;
};

interface AbortSignalEventMap {
    "abort": Event;
}

/**
 * A signal object that allows you to communicate with a DOM request (such as a Fetch) and abort it if required via an AbortController object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal)
 */
interface AbortSignal extends EventTarget {
    /**
     * Returns true if this AbortSignal's AbortController has signaled to abort, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/aborted)
     */
    readonly aborted: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/abort_event) */
    onabort: ((this: AbortSignal, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/reason) */
    readonly reason: any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/throwIfAborted) */
    throwIfAborted(): void;
    addEventListener<K extends keyof AbortSignalEventMap>(type: K, listener: (this: AbortSignal, ev: AbortSignalEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof AbortSignalEventMap>(type: K, listener: (this: AbortSignal, ev: AbortSignalEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var AbortSignal: {
    prototype: AbortSignal;
    new(): AbortSignal;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/abort_static) */
    abort(reason?: any): AbortSignal;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/any_static) */
    any(signals: AbortSignal[]): AbortSignal;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AbortSignal/timeout_static) */
    timeout(milliseconds: number): AbortSignal;
};

interface AbstractWorkerEventMap {
    "error": ErrorEvent;
}

interface AbstractWorker {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorker/error_event) */
    onerror: ((this: AbstractWorker, ev: ErrorEvent) => any) | null;
    addEventListener<K extends keyof AbstractWorkerEventMap>(type: K, listener: (this: AbstractWorker, ev: AbstractWorkerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof AbstractWorkerEventMap>(type: K, listener: (this: AbstractWorker, ev: AbstractWorkerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface AnimationFrameProvider {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/cancelAnimationFrame) */
    cancelAnimationFrame(handle: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame) */
    requestAnimationFrame(callback: FrameRequestCallback): number;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData) */
interface AudioData {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/duration) */
    readonly duration: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/format) */
    readonly format: AudioSampleFormat | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/numberOfChannels) */
    readonly numberOfChannels: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/numberOfFrames) */
    readonly numberOfFrames: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/sampleRate) */
    readonly sampleRate: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/timestamp) */
    readonly timestamp: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/allocationSize) */
    allocationSize(options: AudioDataCopyToOptions): number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/clone) */
    clone(): AudioData;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioData/copyTo) */
    copyTo(destination: AllowSharedBufferSource, options: AudioDataCopyToOptions): void;
}

declare var AudioData: {
    prototype: AudioData;
    new(init: AudioDataInit): AudioData;
};

interface AudioDecoderEventMap {
    "dequeue": Event;
}

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder)
 */
interface AudioDecoder extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/decodeQueueSize) */
    readonly decodeQueueSize: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/dequeue_event) */
    ondequeue: ((this: AudioDecoder, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/state) */
    readonly state: CodecState;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/configure) */
    configure(config: AudioDecoderConfig): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/decode) */
    decode(chunk: EncodedAudioChunk): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/flush) */
    flush(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/reset) */
    reset(): void;
    addEventListener<K extends keyof AudioDecoderEventMap>(type: K, listener: (this: AudioDecoder, ev: AudioDecoderEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof AudioDecoderEventMap>(type: K, listener: (this: AudioDecoder, ev: AudioDecoderEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var AudioDecoder: {
    prototype: AudioDecoder;
    new(init: AudioDecoderInit): AudioDecoder;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioDecoder/isConfigSupported_static) */
    isConfigSupported(config: AudioDecoderConfig): Promise<AudioDecoderSupport>;
};

interface AudioEncoderEventMap {
    "dequeue": Event;
}

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder)
 */
interface AudioEncoder extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/encodeQueueSize) */
    readonly encodeQueueSize: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/dequeue_event) */
    ondequeue: ((this: AudioEncoder, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/state) */
    readonly state: CodecState;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/configure) */
    configure(config: AudioEncoderConfig): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/encode) */
    encode(data: AudioData): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/flush) */
    flush(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/reset) */
    reset(): void;
    addEventListener<K extends keyof AudioEncoderEventMap>(type: K, listener: (this: AudioEncoder, ev: AudioEncoderEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof AudioEncoderEventMap>(type: K, listener: (this: AudioEncoder, ev: AudioEncoderEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var AudioEncoder: {
    prototype: AudioEncoder;
    new(init: AudioEncoderInit): AudioEncoder;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/AudioEncoder/isConfigSupported_static) */
    isConfigSupported(config: AudioEncoderConfig): Promise<AudioEncoderSupport>;
};

/**
 * A file-like object of immutable, raw data. Blobs represent data that isn't necessarily in a JavaScript-native format. The File interface is based on Blob, inheriting blob functionality and expanding it to support files on the user's system.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob)
 */
interface Blob {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/size) */
    readonly size: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/type) */
    readonly type: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/arrayBuffer) */
    arrayBuffer(): Promise<ArrayBuffer>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/bytes) */
    bytes(): Promise<Uint8Array>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/slice) */
    slice(start?: number, end?: number, contentType?: string): Blob;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/stream) */
    stream(): ReadableStream<Uint8Array>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Blob/text) */
    text(): Promise<string>;
}

declare var Blob: {
    prototype: Blob;
    new(blobParts?: BlobPart[], options?: BlobPropertyBag): Blob;
};

interface Body {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/body) */
    readonly body: ReadableStream<Uint8Array> | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/bodyUsed) */
    readonly bodyUsed: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/arrayBuffer) */
    arrayBuffer(): Promise<ArrayBuffer>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/blob) */
    blob(): Promise<Blob>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/bytes) */
    bytes(): Promise<Uint8Array>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/formData) */
    formData(): Promise<FormData>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/json) */
    json(): Promise<any>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/text) */
    text(): Promise<string>;
}

interface BroadcastChannelEventMap {
    "message": MessageEvent;
    "messageerror": MessageEvent;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/BroadcastChannel) */
interface BroadcastChannel extends EventTarget {
    /**
     * Returns the channel name (as passed to the constructor).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/BroadcastChannel/name)
     */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/BroadcastChannel/message_event) */
    onmessage: ((this: BroadcastChannel, ev: MessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/BroadcastChannel/messageerror_event) */
    onmessageerror: ((this: BroadcastChannel, ev: MessageEvent) => any) | null;
    /**
     * Closes the BroadcastChannel object, opening it up to garbage collection.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/BroadcastChannel/close)
     */
    close(): void;
    /**
     * Sends the given message to other BroadcastChannel objects set up for this channel. Messages can be structured objects, e.g. nested objects and arrays.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/BroadcastChannel/postMessage)
     */
    postMessage(message: any): void;
    addEventListener<K extends keyof BroadcastChannelEventMap>(type: K, listener: (this: BroadcastChannel, ev: BroadcastChannelEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof BroadcastChannelEventMap>(type: K, listener: (this: BroadcastChannel, ev: BroadcastChannelEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var BroadcastChannel: {
    prototype: BroadcastChannel;
    new(name: string): BroadcastChannel;
};

/**
 * This Streams API interface provides a built-in byte length queuing strategy that can be used when constructing streams.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ByteLengthQueuingStrategy)
 */
interface ByteLengthQueuingStrategy extends QueuingStrategy<ArrayBufferView> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ByteLengthQueuingStrategy/highWaterMark) */
    readonly highWaterMark: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ByteLengthQueuingStrategy/size) */
    readonly size: QueuingStrategySize<ArrayBufferView>;
}

declare var ByteLengthQueuingStrategy: {
    prototype: ByteLengthQueuingStrategy;
    new(init: QueuingStrategyInit): ByteLengthQueuingStrategy;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSImageValue) */
interface CSSImageValue extends CSSStyleValue {
}

declare var CSSImageValue: {
    prototype: CSSImageValue;
    new(): CSSImageValue;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSKeywordValue) */
interface CSSKeywordValue extends CSSStyleValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSKeywordValue/value) */
    value: string;
}

declare var CSSKeywordValue: {
    prototype: CSSKeywordValue;
    new(value: string): CSSKeywordValue;
};

interface CSSMathClamp extends CSSMathValue {
    readonly lower: CSSNumericValue;
    readonly upper: CSSNumericValue;
    readonly value: CSSNumericValue;
}

declare var CSSMathClamp: {
    prototype: CSSMathClamp;
    new(lower: CSSNumberish, value: CSSNumberish, upper: CSSNumberish): CSSMathClamp;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathInvert) */
interface CSSMathInvert extends CSSMathValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathInvert/value) */
    readonly value: CSSNumericValue;
}

declare var CSSMathInvert: {
    prototype: CSSMathInvert;
    new(arg: CSSNumberish): CSSMathInvert;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathMax) */
interface CSSMathMax extends CSSMathValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathMax/values) */
    readonly values: CSSNumericArray;
}

declare var CSSMathMax: {
    prototype: CSSMathMax;
    new(...args: CSSNumberish[]): CSSMathMax;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathMin) */
interface CSSMathMin extends CSSMathValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathMin/values) */
    readonly values: CSSNumericArray;
}

declare var CSSMathMin: {
    prototype: CSSMathMin;
    new(...args: CSSNumberish[]): CSSMathMin;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathNegate) */
interface CSSMathNegate extends CSSMathValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathNegate/value) */
    readonly value: CSSNumericValue;
}

declare var CSSMathNegate: {
    prototype: CSSMathNegate;
    new(arg: CSSNumberish): CSSMathNegate;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathProduct) */
interface CSSMathProduct extends CSSMathValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathProduct/values) */
    readonly values: CSSNumericArray;
}

declare var CSSMathProduct: {
    prototype: CSSMathProduct;
    new(...args: CSSNumberish[]): CSSMathProduct;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathSum) */
interface CSSMathSum extends CSSMathValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathSum/values) */
    readonly values: CSSNumericArray;
}

declare var CSSMathSum: {
    prototype: CSSMathSum;
    new(...args: CSSNumberish[]): CSSMathSum;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathValue) */
interface CSSMathValue extends CSSNumericValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMathValue/operator) */
    readonly operator: CSSMathOperator;
}

declare var CSSMathValue: {
    prototype: CSSMathValue;
    new(): CSSMathValue;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMatrixComponent) */
interface CSSMatrixComponent extends CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSMatrixComponent/matrix) */
    matrix: DOMMatrix;
}

declare var CSSMatrixComponent: {
    prototype: CSSMatrixComponent;
    new(matrix: DOMMatrixReadOnly, options?: CSSMatrixComponentOptions): CSSMatrixComponent;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericArray) */
interface CSSNumericArray {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericArray/length) */
    readonly length: number;
    forEach(callbackfn: (value: CSSNumericValue, key: number, parent: CSSNumericArray) => void, thisArg?: any): void;
    [index: number]: CSSNumericValue;
}

declare var CSSNumericArray: {
    prototype: CSSNumericArray;
    new(): CSSNumericArray;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue) */
interface CSSNumericValue extends CSSStyleValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/add) */
    add(...values: CSSNumberish[]): CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/div) */
    div(...values: CSSNumberish[]): CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/equals) */
    equals(...value: CSSNumberish[]): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/max) */
    max(...values: CSSNumberish[]): CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/min) */
    min(...values: CSSNumberish[]): CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/mul) */
    mul(...values: CSSNumberish[]): CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/sub) */
    sub(...values: CSSNumberish[]): CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/to) */
    to(unit: string): CSSUnitValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/toSum) */
    toSum(...units: string[]): CSSMathSum;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSNumericValue/type) */
    type(): CSSNumericType;
}

declare var CSSNumericValue: {
    prototype: CSSNumericValue;
    new(): CSSNumericValue;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSPerspective) */
interface CSSPerspective extends CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSPerspective/length) */
    length: CSSPerspectiveValue;
}

declare var CSSPerspective: {
    prototype: CSSPerspective;
    new(length: CSSPerspectiveValue): CSSPerspective;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSRotate) */
interface CSSRotate extends CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSRotate/angle) */
    angle: CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSRotate/x) */
    x: CSSNumberish;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSRotate/y) */
    y: CSSNumberish;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSRotate/z) */
    z: CSSNumberish;
}

declare var CSSRotate: {
    prototype: CSSRotate;
    new(angle: CSSNumericValue): CSSRotate;
    new(x: CSSNumberish, y: CSSNumberish, z: CSSNumberish, angle: CSSNumericValue): CSSRotate;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSScale) */
interface CSSScale extends CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSScale/x) */
    x: CSSNumberish;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSScale/y) */
    y: CSSNumberish;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSScale/z) */
    z: CSSNumberish;
}

declare var CSSScale: {
    prototype: CSSScale;
    new(x: CSSNumberish, y: CSSNumberish, z?: CSSNumberish): CSSScale;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSSkew) */
interface CSSSkew extends CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSSkew/ax) */
    ax: CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSSkew/ay) */
    ay: CSSNumericValue;
}

declare var CSSSkew: {
    prototype: CSSSkew;
    new(ax: CSSNumericValue, ay: CSSNumericValue): CSSSkew;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSSkewX) */
interface CSSSkewX extends CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSSkewX/ax) */
    ax: CSSNumericValue;
}

declare var CSSSkewX: {
    prototype: CSSSkewX;
    new(ax: CSSNumericValue): CSSSkewX;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSSkewY) */
interface CSSSkewY extends CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSSkewY/ay) */
    ay: CSSNumericValue;
}

declare var CSSSkewY: {
    prototype: CSSSkewY;
    new(ay: CSSNumericValue): CSSSkewY;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSStyleValue) */
interface CSSStyleValue {
    toString(): string;
}

declare var CSSStyleValue: {
    prototype: CSSStyleValue;
    new(): CSSStyleValue;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTransformComponent) */
interface CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTransformComponent/is2D) */
    is2D: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTransformComponent/toMatrix) */
    toMatrix(): DOMMatrix;
    toString(): string;
}

declare var CSSTransformComponent: {
    prototype: CSSTransformComponent;
    new(): CSSTransformComponent;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTransformValue) */
interface CSSTransformValue extends CSSStyleValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTransformValue/is2D) */
    readonly is2D: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTransformValue/length) */
    readonly length: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTransformValue/toMatrix) */
    toMatrix(): DOMMatrix;
    forEach(callbackfn: (value: CSSTransformComponent, key: number, parent: CSSTransformValue) => void, thisArg?: any): void;
    [index: number]: CSSTransformComponent;
}

declare var CSSTransformValue: {
    prototype: CSSTransformValue;
    new(transforms: CSSTransformComponent[]): CSSTransformValue;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTranslate) */
interface CSSTranslate extends CSSTransformComponent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTranslate/x) */
    x: CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTranslate/y) */
    y: CSSNumericValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSTranslate/z) */
    z: CSSNumericValue;
}

declare var CSSTranslate: {
    prototype: CSSTranslate;
    new(x: CSSNumericValue, y: CSSNumericValue, z?: CSSNumericValue): CSSTranslate;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSUnitValue) */
interface CSSUnitValue extends CSSNumericValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSUnitValue/unit) */
    readonly unit: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSUnitValue/value) */
    value: number;
}

declare var CSSUnitValue: {
    prototype: CSSUnitValue;
    new(value: number, unit: string): CSSUnitValue;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue) */
interface CSSUnparsedValue extends CSSStyleValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSUnparsedValue/length) */
    readonly length: number;
    forEach(callbackfn: (value: CSSUnparsedSegment, key: number, parent: CSSUnparsedValue) => void, thisArg?: any): void;
    [index: number]: CSSUnparsedSegment;
}

declare var CSSUnparsedValue: {
    prototype: CSSUnparsedValue;
    new(members: CSSUnparsedSegment[]): CSSUnparsedValue;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSVariableReferenceValue) */
interface CSSVariableReferenceValue {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSVariableReferenceValue/fallback) */
    readonly fallback: CSSUnparsedValue | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CSSVariableReferenceValue/variable) */
    variable: string;
}

declare var CSSVariableReferenceValue: {
    prototype: CSSVariableReferenceValue;
    new(variable: string, fallback?: CSSUnparsedValue | null): CSSVariableReferenceValue;
};

/**
 * Provides a storage mechanism for Request / Response object pairs that are cached, for example as part of the ServiceWorker life cycle. Note that the Cache interface is exposed to windowed scopes as well as workers. You don't have to use it in conjunction with service workers, even though it is defined in the service worker spec.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Cache)
 */
interface Cache {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Cache/add) */
    add(request: RequestInfo | URL): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Cache/addAll) */
    addAll(requests: RequestInfo[]): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Cache/delete) */
    delete(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<boolean>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Cache/keys) */
    keys(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<ReadonlyArray<Request>>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Cache/match) */
    match(request: RequestInfo | URL, options?: CacheQueryOptions): Promise<Response | undefined>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Cache/matchAll) */
    matchAll(request?: RequestInfo | URL, options?: CacheQueryOptions): Promise<ReadonlyArray<Response>>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Cache/put) */
    put(request: RequestInfo | URL, response: Response): Promise<void>;
}

declare var Cache: {
    prototype: Cache;
    new(): Cache;
};

/**
 * The storage for Cache objects.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CacheStorage)
 */
interface CacheStorage {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CacheStorage/delete) */
    delete(cacheName: string): Promise<boolean>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CacheStorage/has) */
    has(cacheName: string): Promise<boolean>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CacheStorage/keys) */
    keys(): Promise<string[]>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CacheStorage/match) */
    match(request: RequestInfo | URL, options?: MultiCacheQueryOptions): Promise<Response | undefined>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CacheStorage/open) */
    open(cacheName: string): Promise<Cache>;
}

declare var CacheStorage: {
    prototype: CacheStorage;
    new(): CacheStorage;
};

interface CanvasCompositing {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/globalAlpha) */
    globalAlpha: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/globalCompositeOperation) */
    globalCompositeOperation: GlobalCompositeOperation;
}

interface CanvasDrawImage {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/drawImage) */
    drawImage(image: CanvasImageSource, dx: number, dy: number): void;
    drawImage(image: CanvasImageSource, dx: number, dy: number, dw: number, dh: number): void;
    drawImage(image: CanvasImageSource, sx: number, sy: number, sw: number, sh: number, dx: number, dy: number, dw: number, dh: number): void;
}

interface CanvasDrawPath {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/beginPath) */
    beginPath(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/clip) */
    clip(fillRule?: CanvasFillRule): void;
    clip(path: Path2D, fillRule?: CanvasFillRule): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/fill) */
    fill(fillRule?: CanvasFillRule): void;
    fill(path: Path2D, fillRule?: CanvasFillRule): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/isPointInPath) */
    isPointInPath(x: number, y: number, fillRule?: CanvasFillRule): boolean;
    isPointInPath(path: Path2D, x: number, y: number, fillRule?: CanvasFillRule): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/isPointInStroke) */
    isPointInStroke(x: number, y: number): boolean;
    isPointInStroke(path: Path2D, x: number, y: number): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/stroke) */
    stroke(): void;
    stroke(path: Path2D): void;
}

interface CanvasFillStrokeStyles {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/fillStyle) */
    fillStyle: string | CanvasGradient | CanvasPattern;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/strokeStyle) */
    strokeStyle: string | CanvasGradient | CanvasPattern;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/createConicGradient) */
    createConicGradient(startAngle: number, x: number, y: number): CanvasGradient;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/createLinearGradient) */
    createLinearGradient(x0: number, y0: number, x1: number, y1: number): CanvasGradient;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/createPattern) */
    createPattern(image: CanvasImageSource, repetition: string | null): CanvasPattern | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/createRadialGradient) */
    createRadialGradient(x0: number, y0: number, r0: number, x1: number, y1: number, r1: number): CanvasGradient;
}

interface CanvasFilters {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/filter) */
    filter: string;
}

/**
 * An opaque object describing a gradient. It is returned by the methods CanvasRenderingContext2D.createLinearGradient() or CanvasRenderingContext2D.createRadialGradient().
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasGradient)
 */
interface CanvasGradient {
    /**
     * Adds a color stop with the given color to the gradient at the given offset. 0.0 is the offset at one end of the gradient, 1.0 is the offset at the other end.
     *
     * Throws an "IndexSizeError" DOMException if the offset is out of range. Throws a "SyntaxError" DOMException if the color cannot be parsed.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasGradient/addColorStop)
     */
    addColorStop(offset: number, color: string): void;
}

declare var CanvasGradient: {
    prototype: CanvasGradient;
    new(): CanvasGradient;
};

interface CanvasImageData {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/createImageData) */
    createImageData(sw: number, sh: number, settings?: ImageDataSettings): ImageData;
    createImageData(imagedata: ImageData): ImageData;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/getImageData) */
    getImageData(sx: number, sy: number, sw: number, sh: number, settings?: ImageDataSettings): ImageData;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/putImageData) */
    putImageData(imagedata: ImageData, dx: number, dy: number): void;
    putImageData(imagedata: ImageData, dx: number, dy: number, dirtyX: number, dirtyY: number, dirtyWidth: number, dirtyHeight: number): void;
}

interface CanvasImageSmoothing {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/imageSmoothingEnabled) */
    imageSmoothingEnabled: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/imageSmoothingQuality) */
    imageSmoothingQuality: ImageSmoothingQuality;
}

interface CanvasPath {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/arc) */
    arc(x: number, y: number, radius: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/arcTo) */
    arcTo(x1: number, y1: number, x2: number, y2: number, radius: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/bezierCurveTo) */
    bezierCurveTo(cp1x: number, cp1y: number, cp2x: number, cp2y: number, x: number, y: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/closePath) */
    closePath(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/ellipse) */
    ellipse(x: number, y: number, radiusX: number, radiusY: number, rotation: number, startAngle: number, endAngle: number, counterclockwise?: boolean): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/lineTo) */
    lineTo(x: number, y: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/moveTo) */
    moveTo(x: number, y: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/quadraticCurveTo) */
    quadraticCurveTo(cpx: number, cpy: number, x: number, y: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/rect) */
    rect(x: number, y: number, w: number, h: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/roundRect) */
    roundRect(x: number, y: number, w: number, h: number, radii?: number | DOMPointInit | (number | DOMPointInit)[]): void;
}

interface CanvasPathDrawingStyles {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/lineCap) */
    lineCap: CanvasLineCap;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/lineDashOffset) */
    lineDashOffset: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/lineJoin) */
    lineJoin: CanvasLineJoin;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/lineWidth) */
    lineWidth: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/miterLimit) */
    miterLimit: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/getLineDash) */
    getLineDash(): number[];
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setLineDash) */
    setLineDash(segments: number[]): void;
}

/**
 * An opaque object describing a pattern, based on an image, a canvas, or a video, created by the CanvasRenderingContext2D.createPattern() method.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasPattern)
 */
interface CanvasPattern {
    /**
     * Sets the transformation matrix that will be used when rendering the pattern during a fill or stroke painting operation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasPattern/setTransform)
     */
    setTransform(transform?: DOMMatrix2DInit): void;
}

declare var CanvasPattern: {
    prototype: CanvasPattern;
    new(): CanvasPattern;
};

interface CanvasRect {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/clearRect) */
    clearRect(x: number, y: number, w: number, h: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/fillRect) */
    fillRect(x: number, y: number, w: number, h: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/strokeRect) */
    strokeRect(x: number, y: number, w: number, h: number): void;
}

interface CanvasShadowStyles {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/shadowBlur) */
    shadowBlur: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/shadowColor) */
    shadowColor: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/shadowOffsetX) */
    shadowOffsetX: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/shadowOffsetY) */
    shadowOffsetY: number;
}

interface CanvasState {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/isContextLost) */
    isContextLost(): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/reset) */
    reset(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/restore) */
    restore(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/save) */
    save(): void;
}

interface CanvasText {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/fillText) */
    fillText(text: string, x: number, y: number, maxWidth?: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/measureText) */
    measureText(text: string): TextMetrics;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/strokeText) */
    strokeText(text: string, x: number, y: number, maxWidth?: number): void;
}

interface CanvasTextDrawingStyles {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/direction) */
    direction: CanvasDirection;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/font) */
    font: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/fontKerning) */
    fontKerning: CanvasFontKerning;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/fontStretch) */
    fontStretch: CanvasFontStretch;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/fontVariantCaps) */
    fontVariantCaps: CanvasFontVariantCaps;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/letterSpacing) */
    letterSpacing: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/textAlign) */
    textAlign: CanvasTextAlign;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/textBaseline) */
    textBaseline: CanvasTextBaseline;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/textRendering) */
    textRendering: CanvasTextRendering;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/wordSpacing) */
    wordSpacing: string;
}

interface CanvasTransform {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/getTransform) */
    getTransform(): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/resetTransform) */
    resetTransform(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/rotate) */
    rotate(angle: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/scale) */
    scale(x: number, y: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/setTransform) */
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number): void;
    setTransform(transform?: DOMMatrix2DInit): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/transform) */
    transform(a: number, b: number, c: number, d: number, e: number, f: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/translate) */
    translate(x: number, y: number): void;
}

/**
 * The Client interface represents an executable context such as a Worker, or a SharedWorker. Window clients are represented by the more-specific WindowClient. You can get Client/WindowClient objects from methods such as Clients.matchAll() and Clients.get().
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Client)
 */
interface Client {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Client/frameType) */
    readonly frameType: FrameType;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Client/id) */
    readonly id: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Client/type) */
    readonly type: ClientTypes;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Client/url) */
    readonly url: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Client/postMessage) */
    postMessage(message: any, transfer: Transferable[]): void;
    postMessage(message: any, options?: StructuredSerializeOptions): void;
}

declare var Client: {
    prototype: Client;
    new(): Client;
};

/**
 * Provides access to Client objects. Access it via self.clients within a service worker.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clients)
 */
interface Clients {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clients/claim) */
    claim(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clients/get) */
    get(id: string): Promise<Client | undefined>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clients/matchAll) */
    matchAll<T extends ClientQueryOptions>(options?: T): Promise<ReadonlyArray<T["type"] extends "window" ? WindowClient : Client>>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Clients/openWindow) */
    openWindow(url: string | URL): Promise<WindowClient | null>;
}

declare var Clients: {
    prototype: Clients;
    new(): Clients;
};

/**
 * A CloseEvent is sent to clients using WebSockets when the connection is closed. This is delivered to the listener indicated by the WebSocket object's onclose attribute.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CloseEvent)
 */
interface CloseEvent extends Event {
    /**
     * Returns the WebSocket connection close code provided by the server.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CloseEvent/code)
     */
    readonly code: number;
    /**
     * Returns the WebSocket connection close reason provided by the server.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CloseEvent/reason)
     */
    readonly reason: string;
    /**
     * Returns true if the connection closed cleanly; false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CloseEvent/wasClean)
     */
    readonly wasClean: boolean;
}

declare var CloseEvent: {
    prototype: CloseEvent;
    new(type: string, eventInitDict?: CloseEventInit): CloseEvent;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CompressionStream) */
interface CompressionStream extends GenericTransformStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<BufferSource>;
}

declare var CompressionStream: {
    prototype: CompressionStream;
    new(format: CompressionFormat): CompressionStream;
};

/**
 * This Streams API interface provides a built-in byte length queuing strategy that can be used when constructing streams.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CountQueuingStrategy)
 */
interface CountQueuingStrategy extends QueuingStrategy {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CountQueuingStrategy/highWaterMark) */
    readonly highWaterMark: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CountQueuingStrategy/size) */
    readonly size: QueuingStrategySize;
}

declare var CountQueuingStrategy: {
    prototype: CountQueuingStrategy;
    new(init: QueuingStrategyInit): CountQueuingStrategy;
};

/**
 * Basic cryptography features available in the current context. It allows access to a cryptographically strong random number generator and to cryptographic primitives.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Crypto)
 */
interface Crypto {
    /**
     * Available only in secure contexts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Crypto/subtle)
     */
    readonly subtle: SubtleCrypto;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Crypto/getRandomValues) */
    getRandomValues<T extends ArrayBufferView | null>(array: T): T;
    /**
     * Available only in secure contexts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Crypto/randomUUID)
     */
    randomUUID(): `${string}-${string}-${string}-${string}-${string}`;
}

declare var Crypto: {
    prototype: Crypto;
    new(): Crypto;
};

/**
 * The CryptoKey dictionary of the Web Crypto API represents a cryptographic key.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey)
 */
interface CryptoKey {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/algorithm) */
    readonly algorithm: KeyAlgorithm;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/extractable) */
    readonly extractable: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/type) */
    readonly type: KeyType;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CryptoKey/usages) */
    readonly usages: KeyUsage[];
}

declare var CryptoKey: {
    prototype: CryptoKey;
    new(): CryptoKey;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CustomEvent) */
interface CustomEvent<T = any> extends Event {
    /**
     * Returns any custom data event was created with. Typically used for synthetic events.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CustomEvent/detail)
     */
    readonly detail: T;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/CustomEvent/initCustomEvent)
     */
    initCustomEvent(type: string, bubbles?: boolean, cancelable?: boolean, detail?: T): void;
}

declare var CustomEvent: {
    prototype: CustomEvent;
    new<T>(type: string, eventInitDict?: CustomEventInit<T>): CustomEvent<T>;
};

/**
 * An abnormal event (called an exception) which occurs as a result of calling a method or accessing a property of a web API.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException)
 */
interface DOMException extends Error {
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/code)
     */
    readonly code: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/message) */
    readonly message: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMException/name) */
    readonly name: string;
    readonly INDEX_SIZE_ERR: 1;
    readonly DOMSTRING_SIZE_ERR: 2;
    readonly HIERARCHY_REQUEST_ERR: 3;
    readonly WRONG_DOCUMENT_ERR: 4;
    readonly INVALID_CHARACTER_ERR: 5;
    readonly NO_DATA_ALLOWED_ERR: 6;
    readonly NO_MODIFICATION_ALLOWED_ERR: 7;
    readonly NOT_FOUND_ERR: 8;
    readonly NOT_SUPPORTED_ERR: 9;
    readonly INUSE_ATTRIBUTE_ERR: 10;
    readonly INVALID_STATE_ERR: 11;
    readonly SYNTAX_ERR: 12;
    readonly INVALID_MODIFICATION_ERR: 13;
    readonly NAMESPACE_ERR: 14;
    readonly INVALID_ACCESS_ERR: 15;
    readonly VALIDATION_ERR: 16;
    readonly TYPE_MISMATCH_ERR: 17;
    readonly SECURITY_ERR: 18;
    readonly NETWORK_ERR: 19;
    readonly ABORT_ERR: 20;
    readonly URL_MISMATCH_ERR: 21;
    readonly QUOTA_EXCEEDED_ERR: 22;
    readonly TIMEOUT_ERR: 23;
    readonly INVALID_NODE_TYPE_ERR: 24;
    readonly DATA_CLONE_ERR: 25;
}

declare var DOMException: {
    prototype: DOMException;
    new(message?: string, name?: string): DOMException;
    readonly INDEX_SIZE_ERR: 1;
    readonly DOMSTRING_SIZE_ERR: 2;
    readonly HIERARCHY_REQUEST_ERR: 3;
    readonly WRONG_DOCUMENT_ERR: 4;
    readonly INVALID_CHARACTER_ERR: 5;
    readonly NO_DATA_ALLOWED_ERR: 6;
    readonly NO_MODIFICATION_ALLOWED_ERR: 7;
    readonly NOT_FOUND_ERR: 8;
    readonly NOT_SUPPORTED_ERR: 9;
    readonly INUSE_ATTRIBUTE_ERR: 10;
    readonly INVALID_STATE_ERR: 11;
    readonly SYNTAX_ERR: 12;
    readonly INVALID_MODIFICATION_ERR: 13;
    readonly NAMESPACE_ERR: 14;
    readonly INVALID_ACCESS_ERR: 15;
    readonly VALIDATION_ERR: 16;
    readonly TYPE_MISMATCH_ERR: 17;
    readonly SECURITY_ERR: 18;
    readonly NETWORK_ERR: 19;
    readonly ABORT_ERR: 20;
    readonly URL_MISMATCH_ERR: 21;
    readonly QUOTA_EXCEEDED_ERR: 22;
    readonly TIMEOUT_ERR: 23;
    readonly INVALID_NODE_TYPE_ERR: 24;
    readonly DATA_CLONE_ERR: 25;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix) */
interface DOMMatrix extends DOMMatrixReadOnly {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    a: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    b: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    c: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    d: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    e: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    f: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m11: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m12: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m13: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m14: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m21: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m22: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m23: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m24: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m31: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m32: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m33: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m34: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m41: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m42: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m43: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix#instance_properties) */
    m44: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix/invertSelf) */
    invertSelf(): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix/multiplySelf) */
    multiplySelf(other?: DOMMatrixInit): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix/preMultiplySelf) */
    preMultiplySelf(other?: DOMMatrixInit): DOMMatrix;
    rotateAxisAngleSelf(x?: number, y?: number, z?: number, angle?: number): DOMMatrix;
    rotateFromVectorSelf(x?: number, y?: number): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix/rotateSelf) */
    rotateSelf(rotX?: number, rotY?: number, rotZ?: number): DOMMatrix;
    scale3dSelf(scale?: number, originX?: number, originY?: number, originZ?: number): DOMMatrix;
    scaleSelf(scaleX?: number, scaleY?: number, scaleZ?: number, originX?: number, originY?: number, originZ?: number): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix/skewXSelf) */
    skewXSelf(sx?: number): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix/skewYSelf) */
    skewYSelf(sy?: number): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrix/translateSelf) */
    translateSelf(tx?: number, ty?: number, tz?: number): DOMMatrix;
}

declare var DOMMatrix: {
    prototype: DOMMatrix;
    new(init?: string | number[]): DOMMatrix;
    fromFloat32Array(array32: Float32Array): DOMMatrix;
    fromFloat64Array(array64: Float64Array): DOMMatrix;
    fromMatrix(other?: DOMMatrixInit): DOMMatrix;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly) */
interface DOMMatrixReadOnly {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly a: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly b: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly c: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly d: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly e: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly f: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/is2D) */
    readonly is2D: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/isIdentity) */
    readonly isIdentity: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m11: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m12: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m13: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m14: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m21: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m22: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m23: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m24: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m31: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m32: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m33: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m34: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m41: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m42: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m43: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly#instance_properties) */
    readonly m44: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/flipX) */
    flipX(): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/flipY) */
    flipY(): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/inverse) */
    inverse(): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/multiply) */
    multiply(other?: DOMMatrixInit): DOMMatrix;
    rotate(rotX?: number, rotY?: number, rotZ?: number): DOMMatrix;
    rotateAxisAngle(x?: number, y?: number, z?: number, angle?: number): DOMMatrix;
    rotateFromVector(x?: number, y?: number): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/scale) */
    scale(scaleX?: number, scaleY?: number, scaleZ?: number, originX?: number, originY?: number, originZ?: number): DOMMatrix;
    scale3d(scale?: number, originX?: number, originY?: number, originZ?: number): DOMMatrix;
    /** @deprecated */
    scaleNonUniform(scaleX?: number, scaleY?: number): DOMMatrix;
    skewX(sx?: number): DOMMatrix;
    skewY(sy?: number): DOMMatrix;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/toFloat32Array) */
    toFloat32Array(): Float32Array;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/toFloat64Array) */
    toFloat64Array(): Float64Array;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/toJSON) */
    toJSON(): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/transformPoint) */
    transformPoint(point?: DOMPointInit): DOMPoint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMMatrixReadOnly/translate) */
    translate(tx?: number, ty?: number, tz?: number): DOMMatrix;
}

declare var DOMMatrixReadOnly: {
    prototype: DOMMatrixReadOnly;
    new(init?: string | number[]): DOMMatrixReadOnly;
    fromFloat32Array(array32: Float32Array): DOMMatrixReadOnly;
    fromFloat64Array(array64: Float64Array): DOMMatrixReadOnly;
    fromMatrix(other?: DOMMatrixInit): DOMMatrixReadOnly;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPoint) */
interface DOMPoint extends DOMPointReadOnly {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPoint/w) */
    w: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPoint/x) */
    x: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPoint/y) */
    y: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPoint/z) */
    z: number;
}

declare var DOMPoint: {
    prototype: DOMPoint;
    new(x?: number, y?: number, z?: number, w?: number): DOMPoint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPoint/fromPoint_static) */
    fromPoint(other?: DOMPointInit): DOMPoint;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPointReadOnly) */
interface DOMPointReadOnly {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPointReadOnly/w) */
    readonly w: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPointReadOnly/x) */
    readonly x: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPointReadOnly/y) */
    readonly y: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPointReadOnly/z) */
    readonly z: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPointReadOnly/matrixTransform) */
    matrixTransform(matrix?: DOMMatrixInit): DOMPoint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPointReadOnly/toJSON) */
    toJSON(): any;
}

declare var DOMPointReadOnly: {
    prototype: DOMPointReadOnly;
    new(x?: number, y?: number, z?: number, w?: number): DOMPointReadOnly;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMPointReadOnly/fromPoint_static) */
    fromPoint(other?: DOMPointInit): DOMPointReadOnly;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMQuad) */
interface DOMQuad {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMQuad/p1) */
    readonly p1: DOMPoint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMQuad/p2) */
    readonly p2: DOMPoint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMQuad/p3) */
    readonly p3: DOMPoint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMQuad/p4) */
    readonly p4: DOMPoint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMQuad/getBounds) */
    getBounds(): DOMRect;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMQuad/toJSON) */
    toJSON(): any;
}

declare var DOMQuad: {
    prototype: DOMQuad;
    new(p1?: DOMPointInit, p2?: DOMPointInit, p3?: DOMPointInit, p4?: DOMPointInit): DOMQuad;
    fromQuad(other?: DOMQuadInit): DOMQuad;
    fromRect(other?: DOMRectInit): DOMQuad;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRect) */
interface DOMRect extends DOMRectReadOnly {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRect/height) */
    height: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRect/width) */
    width: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRect/x) */
    x: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRect/y) */
    y: number;
}

declare var DOMRect: {
    prototype: DOMRect;
    new(x?: number, y?: number, width?: number, height?: number): DOMRect;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRect/fromRect_static) */
    fromRect(other?: DOMRectInit): DOMRect;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly) */
interface DOMRectReadOnly {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/bottom) */
    readonly bottom: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/height) */
    readonly height: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/left) */
    readonly left: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/right) */
    readonly right: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/top) */
    readonly top: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/width) */
    readonly width: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/x) */
    readonly x: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/y) */
    readonly y: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/toJSON) */
    toJSON(): any;
}

declare var DOMRectReadOnly: {
    prototype: DOMRectReadOnly;
    new(x?: number, y?: number, width?: number, height?: number): DOMRectReadOnly;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMRectReadOnly/fromRect_static) */
    fromRect(other?: DOMRectInit): DOMRectReadOnly;
};

/**
 * A type returned by some APIs which contains a list of DOMString (strings).
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMStringList)
 */
interface DOMStringList {
    /**
     * Returns the number of strings in strings.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMStringList/length)
     */
    readonly length: number;
    /**
     * Returns true if strings contains string, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMStringList/contains)
     */
    contains(string: string): boolean;
    /**
     * Returns the string with index index from strings.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DOMStringList/item)
     */
    item(index: number): string | null;
    [index: number]: string;
}

declare var DOMStringList: {
    prototype: DOMStringList;
    new(): DOMStringList;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DecompressionStream) */
interface DecompressionStream extends GenericTransformStream {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<BufferSource>;
}

declare var DecompressionStream: {
    prototype: DecompressionStream;
    new(format: CompressionFormat): DecompressionStream;
};

interface DedicatedWorkerGlobalScopeEventMap extends WorkerGlobalScopeEventMap, MessageEventTargetEventMap {
    "message": MessageEvent;
    "messageerror": MessageEvent;
    "rtctransform": RTCTransformEvent;
}

/**
 * (the Worker global scope) is accessible through the self keyword. Some additional global functions, namespaces objects, and constructors, not typically associated with the worker global scope, but available on it, are listed in the JavaScript Reference. See also: Functions available to workers.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope)
 */
interface DedicatedWorkerGlobalScope extends WorkerGlobalScope, AnimationFrameProvider, MessageEventTarget<DedicatedWorkerGlobalScope> {
    /**
     * Returns dedicatedWorkerGlobal's name, i.e. the value given to the Worker constructor. Primarily useful for debugging.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/name)
     */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/rtctransform_event) */
    onrtctransform: ((this: DedicatedWorkerGlobalScope, ev: RTCTransformEvent) => any) | null;
    /**
     * Aborts dedicatedWorkerGlobal.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/close)
     */
    close(): void;
    /**
     * Clones message and transmits it to the Worker object associated with dedicatedWorkerGlobal. transfer can be passed as a list of objects that are to be transferred rather than cloned.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/postMessage)
     */
    postMessage(message: any, transfer: Transferable[]): void;
    postMessage(message: any, options?: StructuredSerializeOptions): void;
    addEventListener<K extends keyof DedicatedWorkerGlobalScopeEventMap>(type: K, listener: (this: DedicatedWorkerGlobalScope, ev: DedicatedWorkerGlobalScopeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof DedicatedWorkerGlobalScopeEventMap>(type: K, listener: (this: DedicatedWorkerGlobalScope, ev: DedicatedWorkerGlobalScopeEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var DedicatedWorkerGlobalScope: {
    prototype: DedicatedWorkerGlobalScope;
    new(): DedicatedWorkerGlobalScope;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_blend_minmax) */
interface EXT_blend_minmax {
    readonly MIN_EXT: 0x8007;
    readonly MAX_EXT: 0x8008;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_color_buffer_float) */
interface EXT_color_buffer_float {
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_color_buffer_half_float) */
interface EXT_color_buffer_half_float {
    readonly RGBA16F_EXT: 0x881A;
    readonly RGB16F_EXT: 0x881B;
    readonly FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT: 0x8211;
    readonly UNSIGNED_NORMALIZED_EXT: 0x8C17;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_float_blend) */
interface EXT_float_blend {
}

/**
 * The EXT_frag_depth extension is part of the WebGL API and enables to set a depth value of a fragment from within the fragment shader.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_frag_depth)
 */
interface EXT_frag_depth {
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_sRGB) */
interface EXT_sRGB {
    readonly SRGB_EXT: 0x8C40;
    readonly SRGB_ALPHA_EXT: 0x8C42;
    readonly SRGB8_ALPHA8_EXT: 0x8C43;
    readonly FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING_EXT: 0x8210;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_shader_texture_lod) */
interface EXT_shader_texture_lod {
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_texture_compression_bptc) */
interface EXT_texture_compression_bptc {
    readonly COMPRESSED_RGBA_BPTC_UNORM_EXT: 0x8E8C;
    readonly COMPRESSED_SRGB_ALPHA_BPTC_UNORM_EXT: 0x8E8D;
    readonly COMPRESSED_RGB_BPTC_SIGNED_FLOAT_EXT: 0x8E8E;
    readonly COMPRESSED_RGB_BPTC_UNSIGNED_FLOAT_EXT: 0x8E8F;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_texture_compression_rgtc) */
interface EXT_texture_compression_rgtc {
    readonly COMPRESSED_RED_RGTC1_EXT: 0x8DBB;
    readonly COMPRESSED_SIGNED_RED_RGTC1_EXT: 0x8DBC;
    readonly COMPRESSED_RED_GREEN_RGTC2_EXT: 0x8DBD;
    readonly COMPRESSED_SIGNED_RED_GREEN_RGTC2_EXT: 0x8DBE;
}

/**
 * The EXT_texture_filter_anisotropic extension is part of the WebGL API and exposes two constants for anisotropic filtering (AF).
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_texture_filter_anisotropic)
 */
interface EXT_texture_filter_anisotropic {
    readonly TEXTURE_MAX_ANISOTROPY_EXT: 0x84FE;
    readonly MAX_TEXTURE_MAX_ANISOTROPY_EXT: 0x84FF;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EXT_texture_norm16) */
interface EXT_texture_norm16 {
    readonly R16_EXT: 0x822A;
    readonly RG16_EXT: 0x822C;
    readonly RGB16_EXT: 0x8054;
    readonly RGBA16_EXT: 0x805B;
    readonly R16_SNORM_EXT: 0x8F98;
    readonly RG16_SNORM_EXT: 0x8F99;
    readonly RGB16_SNORM_EXT: 0x8F9A;
    readonly RGBA16_SNORM_EXT: 0x8F9B;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedAudioChunk) */
interface EncodedAudioChunk {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedAudioChunk/byteLength) */
    readonly byteLength: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedAudioChunk/duration) */
    readonly duration: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedAudioChunk/timestamp) */
    readonly timestamp: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedAudioChunk/type) */
    readonly type: EncodedAudioChunkType;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedAudioChunk/copyTo) */
    copyTo(destination: AllowSharedBufferSource): void;
}

declare var EncodedAudioChunk: {
    prototype: EncodedAudioChunk;
    new(init: EncodedAudioChunkInit): EncodedAudioChunk;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedVideoChunk) */
interface EncodedVideoChunk {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedVideoChunk/byteLength) */
    readonly byteLength: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedVideoChunk/duration) */
    readonly duration: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedVideoChunk/timestamp) */
    readonly timestamp: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedVideoChunk/type) */
    readonly type: EncodedVideoChunkType;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EncodedVideoChunk/copyTo) */
    copyTo(destination: AllowSharedBufferSource): void;
}

declare var EncodedVideoChunk: {
    prototype: EncodedVideoChunk;
    new(init: EncodedVideoChunkInit): EncodedVideoChunk;
};

/**
 * Events providing information related to errors in scripts or in files.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent)
 */
interface ErrorEvent extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/colno) */
    readonly colno: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/error) */
    readonly error: any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/filename) */
    readonly filename: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/lineno) */
    readonly lineno: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ErrorEvent/message) */
    readonly message: string;
}

declare var ErrorEvent: {
    prototype: ErrorEvent;
    new(type: string, eventInitDict?: ErrorEventInit): ErrorEvent;
};

/**
 * An event which takes place in the DOM.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event)
 */
interface Event {
    /**
     * Returns true or false depending on how event was initialized. True if event goes through its target's ancestors in reverse tree order, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/bubbles)
     */
    readonly bubbles: boolean;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelBubble)
     */
    cancelBubble: boolean;
    /**
     * Returns true or false depending on how event was initialized. Its return value does not always carry meaning, but true can indicate that part of the operation during which event was dispatched, can be canceled by invoking the preventDefault() method.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/cancelable)
     */
    readonly cancelable: boolean;
    /**
     * Returns true or false depending on how event was initialized. True if event invokes listeners past a ShadowRoot node that is the root of its target, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composed)
     */
    readonly composed: boolean;
    /**
     * Returns the object whose event listener's callback is currently being invoked.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/currentTarget)
     */
    readonly currentTarget: EventTarget | null;
    /**
     * Returns true if preventDefault() was invoked successfully to indicate cancelation, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/defaultPrevented)
     */
    readonly defaultPrevented: boolean;
    /**
     * Returns the event's phase, which is one of NONE, CAPTURING_PHASE, AT_TARGET, and BUBBLING_PHASE.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/eventPhase)
     */
    readonly eventPhase: number;
    /**
     * Returns true if event was dispatched by the user agent, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/isTrusted)
     */
    readonly isTrusted: boolean;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/returnValue)
     */
    returnValue: boolean;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/srcElement)
     */
    readonly srcElement: EventTarget | null;
    /**
     * Returns the object to which event is dispatched (its target).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/target)
     */
    readonly target: EventTarget | null;
    /**
     * Returns the event's timestamp as the number of milliseconds measured relative to the time origin.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/timeStamp)
     */
    readonly timeStamp: DOMHighResTimeStamp;
    /**
     * Returns the type of event, e.g. "click", "hashchange", or "submit".
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/type)
     */
    readonly type: string;
    /**
     * Returns the invocation target objects of event's path (objects on which listeners will be invoked), except for any nodes in shadow trees of which the shadow root's mode is "closed" that are not reachable from event's currentTarget.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/composedPath)
     */
    composedPath(): EventTarget[];
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/initEvent)
     */
    initEvent(type: string, bubbles?: boolean, cancelable?: boolean): void;
    /**
     * If invoked when the cancelable attribute value is true, and while executing a listener for the event with passive set to false, signals to the operation that caused event to be dispatched that it needs to be canceled.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/preventDefault)
     */
    preventDefault(): void;
    /**
     * Invoking this method prevents event from reaching any registered event listeners after the current one finishes running and, when dispatched in a tree, also prevents event from reaching any other objects.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopImmediatePropagation)
     */
    stopImmediatePropagation(): void;
    /**
     * When dispatched in a tree, invoking this method prevents event from reaching any objects other than the current object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Event/stopPropagation)
     */
    stopPropagation(): void;
    readonly NONE: 0;
    readonly CAPTURING_PHASE: 1;
    readonly AT_TARGET: 2;
    readonly BUBBLING_PHASE: 3;
}

declare var Event: {
    prototype: Event;
    new(type: string, eventInitDict?: EventInit): Event;
    readonly NONE: 0;
    readonly CAPTURING_PHASE: 1;
    readonly AT_TARGET: 2;
    readonly BUBBLING_PHASE: 3;
};

interface EventListener {
    (evt: Event): void;
}

interface EventListenerObject {
    handleEvent(object: Event): void;
}

interface EventSourceEventMap {
    "error": Event;
    "message": MessageEvent;
    "open": Event;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource) */
interface EventSource extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/error_event) */
    onerror: ((this: EventSource, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/message_event) */
    onmessage: ((this: EventSource, ev: MessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/open_event) */
    onopen: ((this: EventSource, ev: Event) => any) | null;
    /**
     * Returns the state of this EventSource object's connection. It can have the values described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/readyState)
     */
    readonly readyState: number;
    /**
     * Returns the URL providing the event stream.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/url)
     */
    readonly url: string;
    /**
     * Returns true if the credentials mode for connection requests to the URL providing the event stream is set to "include", and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/withCredentials)
     */
    readonly withCredentials: boolean;
    /**
     * Aborts any instances of the fetch algorithm started for this EventSource object, and sets the readyState attribute to CLOSED.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventSource/close)
     */
    close(): void;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSED: 2;
    addEventListener<K extends keyof EventSourceEventMap>(type: K, listener: (this: EventSource, ev: EventSourceEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: (this: EventSource, event: MessageEvent) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof EventSourceEventMap>(type: K, listener: (this: EventSource, ev: EventSourceEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: (this: EventSource, event: MessageEvent) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var EventSource: {
    prototype: EventSource;
    new(url: string | URL, eventSourceInitDict?: EventSourceInit): EventSource;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSED: 2;
};

/**
 * EventTarget is a DOM interface implemented by objects that can receive events and may have listeners for them.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget)
 */
interface EventTarget {
    /**
     * Appends an event listener for events whose type attribute value is type. The callback argument sets the callback that will be invoked when the event is dispatched.
     *
     * The options argument sets listener-specific options. For compatibility this can be a boolean, in which case the method behaves exactly as if the value was specified as options's capture.
     *
     * When set to true, options's capture prevents callback from being invoked when the event's eventPhase attribute value is BUBBLING_PHASE. When false (or not present), callback will not be invoked when event's eventPhase attribute value is CAPTURING_PHASE. Either way, callback will be invoked if event's eventPhase attribute value is AT_TARGET.
     *
     * When set to true, options's passive indicates that the callback will not cancel the event by invoking preventDefault(). This is used to enable performance optimizations described in § 2.8 Observing event listeners.
     *
     * When set to true, options's once indicates that the callback will only be invoked once after which the event listener will be removed.
     *
     * If an AbortSignal is passed for options's signal, then the event listener will be removed when signal is aborted.
     *
     * The event listener is appended to target's event listener list and is not appended if it has the same type, callback, and capture.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/addEventListener)
     */
    addEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: AddEventListenerOptions | boolean): void;
    /**
     * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)
     */
    dispatchEvent(event: Event): boolean;
    /**
     * Removes the event listener in target's event listener list with the same type, callback, and options.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/removeEventListener)
     */
    removeEventListener(type: string, callback: EventListenerOrEventListenerObject | null, options?: EventListenerOptions | boolean): void;
}

declare var EventTarget: {
    prototype: EventTarget;
    new(): EventTarget;
};

/**
 * Extends the lifetime of the install and activate events dispatched on the global scope as part of the service worker lifecycle. This ensures that any functional events (like FetchEvent) are not dispatched until it upgrades database schemas and deletes the outdated cache entries.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableEvent)
 */
interface ExtendableEvent extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableEvent/waitUntil) */
    waitUntil(f: Promise<any>): void;
}

declare var ExtendableEvent: {
    prototype: ExtendableEvent;
    new(type: string, eventInitDict?: ExtendableEventInit): ExtendableEvent;
};

/**
 * This ServiceWorker API interface represents the event object of a message event fired on a service worker (when a channel message is received on the ServiceWorkerGlobalScope from another context) — extends the lifetime of such events.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableMessageEvent)
 */
interface ExtendableMessageEvent extends ExtendableEvent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableMessageEvent/data) */
    readonly data: any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableMessageEvent/lastEventId) */
    readonly lastEventId: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableMessageEvent/origin) */
    readonly origin: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableMessageEvent/ports) */
    readonly ports: ReadonlyArray<MessagePort>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ExtendableMessageEvent/source) */
    readonly source: Client | ServiceWorker | MessagePort | null;
}

declare var ExtendableMessageEvent: {
    prototype: ExtendableMessageEvent;
    new(type: string, eventInitDict?: ExtendableMessageEventInit): ExtendableMessageEvent;
};

/**
 * This is the event type for fetch events dispatched on the service worker global scope. It contains information about the fetch, including the request and how the receiver will treat the response. It provides the event.respondWith() method, which allows us to provide a response to this fetch.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent)
 */
interface FetchEvent extends ExtendableEvent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent/clientId) */
    readonly clientId: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent/handled) */
    readonly handled: Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent/preloadResponse) */
    readonly preloadResponse: Promise<any>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent/request) */
    readonly request: Request;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent/resultingClientId) */
    readonly resultingClientId: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FetchEvent/respondWith) */
    respondWith(r: Response | PromiseLike<Response>): void;
}

declare var FetchEvent: {
    prototype: FetchEvent;
    new(type: string, eventInitDict: FetchEventInit): FetchEvent;
};

/**
 * Provides information about files and allows JavaScript in a web page to access their content.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/File)
 */
interface File extends Blob {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/lastModified) */
    readonly lastModified: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/name) */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/File/webkitRelativePath) */
    readonly webkitRelativePath: string;
}

declare var File: {
    prototype: File;
    new(fileBits: BlobPart[], fileName: string, options?: FilePropertyBag): File;
};

/**
 * An object of this type is returned by the files property of the HTML <input> element; this lets you access the list of files selected with the <input type="file"> element. It's also used for a list of files dropped into web content when using the drag and drop API; see the DataTransfer object for details on this usage.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileList)
 */
interface FileList {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileList/length) */
    readonly length: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileList/item) */
    item(index: number): File | null;
    [index: number]: File;
}

declare var FileList: {
    prototype: FileList;
    new(): FileList;
};

interface FileReaderEventMap {
    "abort": ProgressEvent<FileReader>;
    "error": ProgressEvent<FileReader>;
    "load": ProgressEvent<FileReader>;
    "loadend": ProgressEvent<FileReader>;
    "loadstart": ProgressEvent<FileReader>;
    "progress": ProgressEvent<FileReader>;
}

/**
 * Lets web applications asynchronously read the contents of files (or raw data buffers) stored on the user's computer, using File or Blob objects to specify the file or data to read.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader)
 */
interface FileReader extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/error) */
    readonly error: DOMException | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/abort_event) */
    onabort: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/error_event) */
    onerror: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/load_event) */
    onload: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/loadend_event) */
    onloadend: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/loadstart_event) */
    onloadstart: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/progress_event) */
    onprogress: ((this: FileReader, ev: ProgressEvent<FileReader>) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/readyState) */
    readonly readyState: typeof FileReader.EMPTY | typeof FileReader.LOADING | typeof FileReader.DONE;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/result) */
    readonly result: string | ArrayBuffer | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/abort) */
    abort(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/readAsArrayBuffer) */
    readAsArrayBuffer(blob: Blob): void;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/readAsBinaryString)
     */
    readAsBinaryString(blob: Blob): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/readAsDataURL) */
    readAsDataURL(blob: Blob): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReader/readAsText) */
    readAsText(blob: Blob, encoding?: string): void;
    readonly EMPTY: 0;
    readonly LOADING: 1;
    readonly DONE: 2;
    addEventListener<K extends keyof FileReaderEventMap>(type: K, listener: (this: FileReader, ev: FileReaderEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof FileReaderEventMap>(type: K, listener: (this: FileReader, ev: FileReaderEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var FileReader: {
    prototype: FileReader;
    new(): FileReader;
    readonly EMPTY: 0;
    readonly LOADING: 1;
    readonly DONE: 2;
};

/**
 * Allows to read File or Blob objects in a synchronous way.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReaderSync)
 */
interface FileReaderSync {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReaderSync/readAsArrayBuffer) */
    readAsArrayBuffer(blob: Blob): ArrayBuffer;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReaderSync/readAsBinaryString)
     */
    readAsBinaryString(blob: Blob): string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReaderSync/readAsDataURL) */
    readAsDataURL(blob: Blob): string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileReaderSync/readAsText) */
    readAsText(blob: Blob, encoding?: string): string;
}

declare var FileReaderSync: {
    prototype: FileReaderSync;
    new(): FileReaderSync;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemDirectoryHandle)
 */
interface FileSystemDirectoryHandle extends FileSystemHandle {
    readonly kind: "directory";
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemDirectoryHandle/getDirectoryHandle) */
    getDirectoryHandle(name: string, options?: FileSystemGetDirectoryOptions): Promise<FileSystemDirectoryHandle>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemDirectoryHandle/getFileHandle) */
    getFileHandle(name: string, options?: FileSystemGetFileOptions): Promise<FileSystemFileHandle>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemDirectoryHandle/removeEntry) */
    removeEntry(name: string, options?: FileSystemRemoveOptions): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemDirectoryHandle/resolve) */
    resolve(possibleDescendant: FileSystemHandle): Promise<string[] | null>;
}

declare var FileSystemDirectoryHandle: {
    prototype: FileSystemDirectoryHandle;
    new(): FileSystemDirectoryHandle;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemFileHandle)
 */
interface FileSystemFileHandle extends FileSystemHandle {
    readonly kind: "file";
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemFileHandle/createSyncAccessHandle) */
    createSyncAccessHandle(): Promise<FileSystemSyncAccessHandle>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemFileHandle/createWritable) */
    createWritable(options?: FileSystemCreateWritableOptions): Promise<FileSystemWritableFileStream>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemFileHandle/getFile) */
    getFile(): Promise<File>;
}

declare var FileSystemFileHandle: {
    prototype: FileSystemFileHandle;
    new(): FileSystemFileHandle;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemHandle)
 */
interface FileSystemHandle {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemHandle/kind) */
    readonly kind: FileSystemHandleKind;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemHandle/name) */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemHandle/isSameEntry) */
    isSameEntry(other: FileSystemHandle): Promise<boolean>;
}

declare var FileSystemHandle: {
    prototype: FileSystemHandle;
    new(): FileSystemHandle;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemSyncAccessHandle)
 */
interface FileSystemSyncAccessHandle {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemSyncAccessHandle/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemSyncAccessHandle/flush) */
    flush(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemSyncAccessHandle/getSize) */
    getSize(): number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemSyncAccessHandle/read) */
    read(buffer: AllowSharedBufferSource, options?: FileSystemReadWriteOptions): number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemSyncAccessHandle/truncate) */
    truncate(newSize: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemSyncAccessHandle/write) */
    write(buffer: AllowSharedBufferSource, options?: FileSystemReadWriteOptions): number;
}

declare var FileSystemSyncAccessHandle: {
    prototype: FileSystemSyncAccessHandle;
    new(): FileSystemSyncAccessHandle;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemWritableFileStream)
 */
interface FileSystemWritableFileStream extends WritableStream {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemWritableFileStream/seek) */
    seek(position: number): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemWritableFileStream/truncate) */
    truncate(size: number): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FileSystemWritableFileStream/write) */
    write(data: FileSystemWriteChunkType): Promise<void>;
}

declare var FileSystemWritableFileStream: {
    prototype: FileSystemWritableFileStream;
    new(): FileSystemWritableFileStream;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace) */
interface FontFace {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/ascentOverride) */
    ascentOverride: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/descentOverride) */
    descentOverride: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/display) */
    display: FontDisplay;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/family) */
    family: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/featureSettings) */
    featureSettings: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/lineGapOverride) */
    lineGapOverride: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/loaded) */
    readonly loaded: Promise<FontFace>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/status) */
    readonly status: FontFaceLoadStatus;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/stretch) */
    stretch: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/style) */
    style: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/unicodeRange) */
    unicodeRange: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/weight) */
    weight: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFace/load) */
    load(): Promise<FontFace>;
}

declare var FontFace: {
    prototype: FontFace;
    new(family: string, source: string | BufferSource, descriptors?: FontFaceDescriptors): FontFace;
};

interface FontFaceSetEventMap {
    "loading": FontFaceSetLoadEvent;
    "loadingdone": FontFaceSetLoadEvent;
    "loadingerror": FontFaceSetLoadEvent;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSet) */
interface FontFaceSet extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSet/loading_event) */
    onloading: ((this: FontFaceSet, ev: FontFaceSetLoadEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSet/loadingdone_event) */
    onloadingdone: ((this: FontFaceSet, ev: FontFaceSetLoadEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSet/loadingerror_event) */
    onloadingerror: ((this: FontFaceSet, ev: FontFaceSetLoadEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSet/ready) */
    readonly ready: Promise<FontFaceSet>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSet/status) */
    readonly status: FontFaceSetLoadStatus;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSet/check) */
    check(font: string, text?: string): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSet/load) */
    load(font: string, text?: string): Promise<FontFace[]>;
    forEach(callbackfn: (value: FontFace, key: FontFace, parent: FontFaceSet) => void, thisArg?: any): void;
    addEventListener<K extends keyof FontFaceSetEventMap>(type: K, listener: (this: FontFaceSet, ev: FontFaceSetEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof FontFaceSetEventMap>(type: K, listener: (this: FontFaceSet, ev: FontFaceSetEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var FontFaceSet: {
    prototype: FontFaceSet;
    new(): FontFaceSet;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSetLoadEvent) */
interface FontFaceSetLoadEvent extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FontFaceSetLoadEvent/fontfaces) */
    readonly fontfaces: ReadonlyArray<FontFace>;
}

declare var FontFaceSetLoadEvent: {
    prototype: FontFaceSetLoadEvent;
    new(type: string, eventInitDict?: FontFaceSetLoadEventInit): FontFaceSetLoadEvent;
};

interface FontFaceSource {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/fonts) */
    readonly fonts: FontFaceSet;
}

/**
 * Provides a way to easily construct a set of key/value pairs representing form fields and their values, which can then be easily sent using the XMLHttpRequest.send() method. It uses the same format a form would use if the encoding type were set to "multipart/form-data".
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData)
 */
interface FormData {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/append) */
    append(name: string, value: string | Blob): void;
    append(name: string, value: string): void;
    append(name: string, blobValue: Blob, filename?: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/delete) */
    delete(name: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/get) */
    get(name: string): FormDataEntryValue | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/getAll) */
    getAll(name: string): FormDataEntryValue[];
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/has) */
    has(name: string): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/FormData/set) */
    set(name: string, value: string | Blob): void;
    set(name: string, value: string): void;
    set(name: string, blobValue: Blob, filename?: string): void;
    forEach(callbackfn: (value: FormDataEntryValue, key: string, parent: FormData) => void, thisArg?: any): void;
}

declare var FormData: {
    prototype: FormData;
    new(): FormData;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/GPUError)
 */
interface GPUError {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/GPUError/message) */
    readonly message: string;
}

interface GenericTransformStream {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CompressionStream/readable) */
    readonly readable: ReadableStream;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CompressionStream/writable) */
    readonly writable: WritableStream;
}

/**
 * This Fetch API interface allows you to perform various actions on HTTP request and response headers. These actions include retrieving, setting, adding to, and removing. A Headers object has an associated header list, which is initially empty and consists of zero or more name and value pairs.  You can add to this using methods like append() (see Examples.) In all methods of this interface, header names are matched by case-insensitive byte sequence.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers)
 */
interface Headers {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/append) */
    append(name: string, value: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/delete) */
    delete(name: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/get) */
    get(name: string): string | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/getSetCookie) */
    getSetCookie(): string[];
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/has) */
    has(name: string): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Headers/set) */
    set(name: string, value: string): void;
    forEach(callbackfn: (value: string, key: string, parent: Headers) => void, thisArg?: any): void;
}

declare var Headers: {
    prototype: Headers;
    new(init?: HeadersInit): Headers;
};

/**
 * This IndexedDB API interface represents a cursor for traversing or iterating over multiple records in a database.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor)
 */
interface IDBCursor {
    /**
     * Returns the direction ("next", "nextunique", "prev" or "prevunique") of the cursor.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/direction)
     */
    readonly direction: IDBCursorDirection;
    /**
     * Returns the key of the cursor. Throws a "InvalidStateError" DOMException if the cursor is advancing or is finished.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/key)
     */
    readonly key: IDBValidKey;
    /**
     * Returns the effective key of the cursor. Throws a "InvalidStateError" DOMException if the cursor is advancing or is finished.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/primaryKey)
     */
    readonly primaryKey: IDBValidKey;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/request) */
    readonly request: IDBRequest;
    /**
     * Returns the IDBObjectStore or IDBIndex the cursor was opened from.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/source)
     */
    readonly source: IDBObjectStore | IDBIndex;
    /**
     * Advances the cursor through the next count records in range.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/advance)
     */
    advance(count: number): void;
    /**
     * Advances the cursor to the next record in range.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/continue)
     */
    continue(key?: IDBValidKey): void;
    /**
     * Advances the cursor to the next record in range matching or after key and primaryKey. Throws an "InvalidAccessError" DOMException if the source is not an index.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/continuePrimaryKey)
     */
    continuePrimaryKey(key: IDBValidKey, primaryKey: IDBValidKey): void;
    /**
     * Delete the record pointed at by the cursor with a new value.
     *
     * If successful, request's result will be undefined.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/delete)
     */
    delete(): IDBRequest<undefined>;
    /**
     * Updated the record pointed at by the cursor with a new value.
     *
     * Throws a "DataError" DOMException if the effective object store uses in-line keys and the key would have changed.
     *
     * If successful, request's result will be the record's key.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursor/update)
     */
    update(value: any): IDBRequest<IDBValidKey>;
}

declare var IDBCursor: {
    prototype: IDBCursor;
    new(): IDBCursor;
};

/**
 * This IndexedDB API interface represents a cursor for traversing or iterating over multiple records in a database. It is the same as the IDBCursor, except that it includes the value property.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursorWithValue)
 */
interface IDBCursorWithValue extends IDBCursor {
    /**
     * Returns the cursor's current value.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBCursorWithValue/value)
     */
    readonly value: any;
}

declare var IDBCursorWithValue: {
    prototype: IDBCursorWithValue;
    new(): IDBCursorWithValue;
};

interface IDBDatabaseEventMap {
    "abort": Event;
    "close": Event;
    "error": Event;
    "versionchange": IDBVersionChangeEvent;
}

/**
 * This IndexedDB API interface provides a connection to a database; you can use an IDBDatabase object to open a transaction on your database then create, manipulate, and delete objects (data) in that database. The interface provides the only way to get and manage versions of the database.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase)
 */
interface IDBDatabase extends EventTarget {
    /**
     * Returns the name of the database.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/name)
     */
    readonly name: string;
    /**
     * Returns a list of the names of object stores in the database.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/objectStoreNames)
     */
    readonly objectStoreNames: DOMStringList;
    onabort: ((this: IDBDatabase, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/close_event) */
    onclose: ((this: IDBDatabase, ev: Event) => any) | null;
    onerror: ((this: IDBDatabase, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/versionchange_event) */
    onversionchange: ((this: IDBDatabase, ev: IDBVersionChangeEvent) => any) | null;
    /**
     * Returns the version of the database.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/version)
     */
    readonly version: number;
    /**
     * Closes the connection once all running transactions have finished.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/close)
     */
    close(): void;
    /**
     * Creates a new object store with the given name and options and returns a new IDBObjectStore.
     *
     * Throws a "InvalidStateError" DOMException if not called within an upgrade transaction.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/createObjectStore)
     */
    createObjectStore(name: string, options?: IDBObjectStoreParameters): IDBObjectStore;
    /**
     * Deletes the object store with the given name.
     *
     * Throws a "InvalidStateError" DOMException if not called within an upgrade transaction.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/deleteObjectStore)
     */
    deleteObjectStore(name: string): void;
    /**
     * Returns a new transaction with the given mode ("readonly" or "readwrite") and scope which can be a single object store name or an array of names.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBDatabase/transaction)
     */
    transaction(storeNames: string | string[], mode?: IDBTransactionMode, options?: IDBTransactionOptions): IDBTransaction;
    addEventListener<K extends keyof IDBDatabaseEventMap>(type: K, listener: (this: IDBDatabase, ev: IDBDatabaseEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof IDBDatabaseEventMap>(type: K, listener: (this: IDBDatabase, ev: IDBDatabaseEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var IDBDatabase: {
    prototype: IDBDatabase;
    new(): IDBDatabase;
};

/**
 * In the following code snippet, we make a request to open a database, and include handlers for the success and error cases. For a full working example, see our To-do Notifications app (view example live.)
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBFactory)
 */
interface IDBFactory {
    /**
     * Compares two values as keys. Returns -1 if key1 precedes key2, 1 if key2 precedes key1, and 0 if the keys are equal.
     *
     * Throws a "DataError" DOMException if either input is not a valid key.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBFactory/cmp)
     */
    cmp(first: any, second: any): number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBFactory/databases) */
    databases(): Promise<IDBDatabaseInfo[]>;
    /**
     * Attempts to delete the named database. If the database already exists and there are open connections that don't close in response to a versionchange event, the request will be blocked until all they close. If the request is successful request's result will be null.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBFactory/deleteDatabase)
     */
    deleteDatabase(name: string): IDBOpenDBRequest;
    /**
     * Attempts to open a connection to the named database with the current version, or 1 if it does not already exist. If the request is successful request's result will be the connection.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBFactory/open)
     */
    open(name: string, version?: number): IDBOpenDBRequest;
}

declare var IDBFactory: {
    prototype: IDBFactory;
    new(): IDBFactory;
};

/**
 * IDBIndex interface of the IndexedDB API provides asynchronous access to an index in a database. An index is a kind of object store for looking up records in another object store, called the referenced object store. You use this interface to retrieve data.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex)
 */
interface IDBIndex {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/keyPath) */
    readonly keyPath: string | string[];
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/multiEntry) */
    readonly multiEntry: boolean;
    /**
     * Returns the name of the index.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/name)
     */
    name: string;
    /**
     * Returns the IDBObjectStore the index belongs to.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/objectStore)
     */
    readonly objectStore: IDBObjectStore;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/unique) */
    readonly unique: boolean;
    /**
     * Retrieves the number of records matching the given key or key range in query.
     *
     * If successful, request's result will be the count.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/count)
     */
    count(query?: IDBValidKey | IDBKeyRange): IDBRequest<number>;
    /**
     * Retrieves the value of the first record matching the given key or key range in query.
     *
     * If successful, request's result will be the value, or undefined if there was no matching record.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/get)
     */
    get(query: IDBValidKey | IDBKeyRange): IDBRequest<any>;
    /**
     * Retrieves the values of the records matching the given key or key range in query (up to count if given).
     *
     * If successful, request's result will be an Array of the values.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/getAll)
     */
    getAll(query?: IDBValidKey | IDBKeyRange | null, count?: number): IDBRequest<any[]>;
    /**
     * Retrieves the keys of records matching the given key or key range in query (up to count if given).
     *
     * If successful, request's result will be an Array of the keys.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/getAllKeys)
     */
    getAllKeys(query?: IDBValidKey | IDBKeyRange | null, count?: number): IDBRequest<IDBValidKey[]>;
    /**
     * Retrieves the key of the first record matching the given key or key range in query.
     *
     * If successful, request's result will be the key, or undefined if there was no matching record.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/getKey)
     */
    getKey(query: IDBValidKey | IDBKeyRange): IDBRequest<IDBValidKey | undefined>;
    /**
     * Opens a cursor over the records matching query, ordered by direction. If query is null, all records in index are matched.
     *
     * If successful, request's result will be an IDBCursorWithValue, or null if there were no matching records.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/openCursor)
     */
    openCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursorWithValue | null>;
    /**
     * Opens a cursor with key only flag set over the records matching query, ordered by direction. If query is null, all records in index are matched.
     *
     * If successful, request's result will be an IDBCursor, or null if there were no matching records.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBIndex/openKeyCursor)
     */
    openKeyCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursor | null>;
}

declare var IDBIndex: {
    prototype: IDBIndex;
    new(): IDBIndex;
};

/**
 * A key range can be a single value or a range with upper and lower bounds or endpoints. If the key range has both upper and lower bounds, then it is bounded; if it has no bounds, it is unbounded. A bounded key range can either be open (the endpoints are excluded) or closed (the endpoints are included). To retrieve all keys within a certain range, you can use the following code constructs:
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange)
 */
interface IDBKeyRange {
    /**
     * Returns lower bound, or undefined if none.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/lower)
     */
    readonly lower: any;
    /**
     * Returns true if the lower open flag is set, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/lowerOpen)
     */
    readonly lowerOpen: boolean;
    /**
     * Returns upper bound, or undefined if none.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/upper)
     */
    readonly upper: any;
    /**
     * Returns true if the upper open flag is set, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/upperOpen)
     */
    readonly upperOpen: boolean;
    /**
     * Returns true if key is included in the range, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/includes)
     */
    includes(key: any): boolean;
}

declare var IDBKeyRange: {
    prototype: IDBKeyRange;
    new(): IDBKeyRange;
    /**
     * Returns a new IDBKeyRange spanning from lower to upper. If lowerOpen is true, lower is not included in the range. If upperOpen is true, upper is not included in the range.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/bound_static)
     */
    bound(lower: any, upper: any, lowerOpen?: boolean, upperOpen?: boolean): IDBKeyRange;
    /**
     * Returns a new IDBKeyRange starting at key with no upper bound. If open is true, key is not included in the range.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/lowerBound_static)
     */
    lowerBound(lower: any, open?: boolean): IDBKeyRange;
    /**
     * Returns a new IDBKeyRange spanning only key.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/only_static)
     */
    only(value: any): IDBKeyRange;
    /**
     * Returns a new IDBKeyRange with no lower bound and ending at key. If open is true, key is not included in the range.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBKeyRange/upperBound_static)
     */
    upperBound(upper: any, open?: boolean): IDBKeyRange;
};

/**
 * This example shows a variety of different uses of object stores, from updating the data structure with IDBObjectStore.createIndex inside an onupgradeneeded function, to adding a new item to our object store with IDBObjectStore.add. For a full working example, see our To-do Notifications app (view example live.)
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore)
 */
interface IDBObjectStore {
    /**
     * Returns true if the store has a key generator, and false otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/autoIncrement)
     */
    readonly autoIncrement: boolean;
    /**
     * Returns a list of the names of indexes in the store.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/indexNames)
     */
    readonly indexNames: DOMStringList;
    /**
     * Returns the key path of the store, or null if none.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/keyPath)
     */
    readonly keyPath: string | string[];
    /**
     * Returns the name of the store.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/name)
     */
    name: string;
    /**
     * Returns the associated transaction.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/transaction)
     */
    readonly transaction: IDBTransaction;
    /**
     * Adds or updates a record in store with the given value and key.
     *
     * If the store uses in-line keys and key is specified a "DataError" DOMException will be thrown.
     *
     * If put() is used, any existing record with the key will be replaced. If add() is used, and if a record with the key already exists the request will fail, with request's error set to a "ConstraintError" DOMException.
     *
     * If successful, request's result will be the record's key.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/add)
     */
    add(value: any, key?: IDBValidKey): IDBRequest<IDBValidKey>;
    /**
     * Deletes all records in store.
     *
     * If successful, request's result will be undefined.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/clear)
     */
    clear(): IDBRequest<undefined>;
    /**
     * Retrieves the number of records matching the given key or key range in query.
     *
     * If successful, request's result will be the count.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/count)
     */
    count(query?: IDBValidKey | IDBKeyRange): IDBRequest<number>;
    /**
     * Creates a new index in store with the given name, keyPath and options and returns a new IDBIndex. If the keyPath and options define constraints that cannot be satisfied with the data already in store the upgrade transaction will abort with a "ConstraintError" DOMException.
     *
     * Throws an "InvalidStateError" DOMException if not called within an upgrade transaction.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/createIndex)
     */
    createIndex(name: string, keyPath: string | string[], options?: IDBIndexParameters): IDBIndex;
    /**
     * Deletes records in store with the given key or in the given key range in query.
     *
     * If successful, request's result will be undefined.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/delete)
     */
    delete(query: IDBValidKey | IDBKeyRange): IDBRequest<undefined>;
    /**
     * Deletes the index in store with the given name.
     *
     * Throws an "InvalidStateError" DOMException if not called within an upgrade transaction.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/deleteIndex)
     */
    deleteIndex(name: string): void;
    /**
     * Retrieves the value of the first record matching the given key or key range in query.
     *
     * If successful, request's result will be the value, or undefined if there was no matching record.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/get)
     */
    get(query: IDBValidKey | IDBKeyRange): IDBRequest<any>;
    /**
     * Retrieves the values of the records matching the given key or key range in query (up to count if given).
     *
     * If successful, request's result will be an Array of the values.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/getAll)
     */
    getAll(query?: IDBValidKey | IDBKeyRange | null, count?: number): IDBRequest<any[]>;
    /**
     * Retrieves the keys of records matching the given key or key range in query (up to count if given).
     *
     * If successful, request's result will be an Array of the keys.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/getAllKeys)
     */
    getAllKeys(query?: IDBValidKey | IDBKeyRange | null, count?: number): IDBRequest<IDBValidKey[]>;
    /**
     * Retrieves the key of the first record matching the given key or key range in query.
     *
     * If successful, request's result will be the key, or undefined if there was no matching record.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/getKey)
     */
    getKey(query: IDBValidKey | IDBKeyRange): IDBRequest<IDBValidKey | undefined>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/index) */
    index(name: string): IDBIndex;
    /**
     * Opens a cursor over the records matching query, ordered by direction. If query is null, all records in store are matched.
     *
     * If successful, request's result will be an IDBCursorWithValue pointing at the first matching record, or null if there were no matching records.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/openCursor)
     */
    openCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursorWithValue | null>;
    /**
     * Opens a cursor with key only flag set over the records matching query, ordered by direction. If query is null, all records in store are matched.
     *
     * If successful, request's result will be an IDBCursor pointing at the first matching record, or null if there were no matching records.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/openKeyCursor)
     */
    openKeyCursor(query?: IDBValidKey | IDBKeyRange | null, direction?: IDBCursorDirection): IDBRequest<IDBCursor | null>;
    /**
     * Adds or updates a record in store with the given value and key.
     *
     * If the store uses in-line keys and key is specified a "DataError" DOMException will be thrown.
     *
     * If put() is used, any existing record with the key will be replaced. If add() is used, and if a record with the key already exists the request will fail, with request's error set to a "ConstraintError" DOMException.
     *
     * If successful, request's result will be the record's key.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBObjectStore/put)
     */
    put(value: any, key?: IDBValidKey): IDBRequest<IDBValidKey>;
}

declare var IDBObjectStore: {
    prototype: IDBObjectStore;
    new(): IDBObjectStore;
};

interface IDBOpenDBRequestEventMap extends IDBRequestEventMap {
    "blocked": IDBVersionChangeEvent;
    "upgradeneeded": IDBVersionChangeEvent;
}

/**
 * Also inherits methods from its parents IDBRequest and EventTarget.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBOpenDBRequest)
 */
interface IDBOpenDBRequest extends IDBRequest<IDBDatabase> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBOpenDBRequest/blocked_event) */
    onblocked: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBOpenDBRequest/upgradeneeded_event) */
    onupgradeneeded: ((this: IDBOpenDBRequest, ev: IDBVersionChangeEvent) => any) | null;
    addEventListener<K extends keyof IDBOpenDBRequestEventMap>(type: K, listener: (this: IDBOpenDBRequest, ev: IDBOpenDBRequestEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof IDBOpenDBRequestEventMap>(type: K, listener: (this: IDBOpenDBRequest, ev: IDBOpenDBRequestEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var IDBOpenDBRequest: {
    prototype: IDBOpenDBRequest;
    new(): IDBOpenDBRequest;
};

interface IDBRequestEventMap {
    "error": Event;
    "success": Event;
}

/**
 * The request object does not initially contain any information about the result of the operation, but once information becomes available, an event is fired on the request, and the information becomes available through the properties of the IDBRequest instance.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBRequest)
 */
interface IDBRequest<T = any> extends EventTarget {
    /**
     * When a request is completed, returns the error (a DOMException), or null if the request succeeded. Throws a "InvalidStateError" DOMException if the request is still pending.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBRequest/error)
     */
    readonly error: DOMException | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBRequest/error_event) */
    onerror: ((this: IDBRequest<T>, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBRequest/success_event) */
    onsuccess: ((this: IDBRequest<T>, ev: Event) => any) | null;
    /**
     * Returns "pending" until a request is complete, then returns "done".
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBRequest/readyState)
     */
    readonly readyState: IDBRequestReadyState;
    /**
     * When a request is completed, returns the result, or undefined if the request failed. Throws a "InvalidStateError" DOMException if the request is still pending.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBRequest/result)
     */
    readonly result: T;
    /**
     * Returns the IDBObjectStore, IDBIndex, or IDBCursor the request was made against, or null if is was an open request.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBRequest/source)
     */
    readonly source: IDBObjectStore | IDBIndex | IDBCursor;
    /**
     * Returns the IDBTransaction the request was made within. If this as an open request, then it returns an upgrade transaction while it is running, or null otherwise.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBRequest/transaction)
     */
    readonly transaction: IDBTransaction | null;
    addEventListener<K extends keyof IDBRequestEventMap>(type: K, listener: (this: IDBRequest<T>, ev: IDBRequestEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof IDBRequestEventMap>(type: K, listener: (this: IDBRequest<T>, ev: IDBRequestEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var IDBRequest: {
    prototype: IDBRequest;
    new(): IDBRequest;
};

interface IDBTransactionEventMap {
    "abort": Event;
    "complete": Event;
    "error": Event;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction) */
interface IDBTransaction extends EventTarget {
    /**
     * Returns the transaction's connection.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/db)
     */
    readonly db: IDBDatabase;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/durability) */
    readonly durability: IDBTransactionDurability;
    /**
     * If the transaction was aborted, returns the error (a DOMException) providing the reason.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/error)
     */
    readonly error: DOMException | null;
    /**
     * Returns the mode the transaction was created with ("readonly" or "readwrite"), or "versionchange" for an upgrade transaction.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/mode)
     */
    readonly mode: IDBTransactionMode;
    /**
     * Returns a list of the names of object stores in the transaction's scope. For an upgrade transaction this is all object stores in the database.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/objectStoreNames)
     */
    readonly objectStoreNames: DOMStringList;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/abort_event) */
    onabort: ((this: IDBTransaction, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/complete_event) */
    oncomplete: ((this: IDBTransaction, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/error_event) */
    onerror: ((this: IDBTransaction, ev: Event) => any) | null;
    /**
     * Aborts the transaction. All pending requests will fail with a "AbortError" DOMException and all changes made to the database will be reverted.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/abort)
     */
    abort(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/commit) */
    commit(): void;
    /**
     * Returns an IDBObjectStore in the transaction's scope.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBTransaction/objectStore)
     */
    objectStore(name: string): IDBObjectStore;
    addEventListener<K extends keyof IDBTransactionEventMap>(type: K, listener: (this: IDBTransaction, ev: IDBTransactionEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof IDBTransactionEventMap>(type: K, listener: (this: IDBTransaction, ev: IDBTransactionEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var IDBTransaction: {
    prototype: IDBTransaction;
    new(): IDBTransaction;
};

/**
 * This IndexedDB API interface indicates that the version of the database has changed, as the result of an IDBOpenDBRequest.onupgradeneeded event handler function.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBVersionChangeEvent)
 */
interface IDBVersionChangeEvent extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBVersionChangeEvent/newVersion) */
    readonly newVersion: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/IDBVersionChangeEvent/oldVersion) */
    readonly oldVersion: number;
}

declare var IDBVersionChangeEvent: {
    prototype: IDBVersionChangeEvent;
    new(type: string, eventInitDict?: IDBVersionChangeEventInit): IDBVersionChangeEvent;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageBitmap) */
interface ImageBitmap {
    /**
     * Returns the intrinsic height of the image, in CSS pixels.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageBitmap/height)
     */
    readonly height: number;
    /**
     * Returns the intrinsic width of the image, in CSS pixels.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageBitmap/width)
     */
    readonly width: number;
    /**
     * Releases imageBitmap's underlying bitmap data.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageBitmap/close)
     */
    close(): void;
}

declare var ImageBitmap: {
    prototype: ImageBitmap;
    new(): ImageBitmap;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageBitmapRenderingContext) */
interface ImageBitmapRenderingContext {
    /**
     * Transfers the underlying bitmap data from imageBitmap to context, and the bitmap becomes the contents of the canvas element to which context is bound.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageBitmapRenderingContext/transferFromImageBitmap)
     */
    transferFromImageBitmap(bitmap: ImageBitmap | null): void;
}

declare var ImageBitmapRenderingContext: {
    prototype: ImageBitmapRenderingContext;
    new(): ImageBitmapRenderingContext;
};

/**
 * The underlying pixel data of an area of a <canvas> element. It is created using the ImageData() constructor or creator methods on the CanvasRenderingContext2D object associated with a canvas: createImageData() and getImageData(). It can also be used to set a part of the canvas by using putImageData().
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageData)
 */
interface ImageData {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageData/colorSpace) */
    readonly colorSpace: PredefinedColorSpace;
    /**
     * Returns the one-dimensional array containing the data in RGBA order, as integers in the range 0 to 255.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageData/data)
     */
    readonly data: Uint8ClampedArray;
    /**
     * Returns the actual dimensions of the data in the ImageData object, in pixels.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageData/height)
     */
    readonly height: number;
    /**
     * Returns the actual dimensions of the data in the ImageData object, in pixels.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageData/width)
     */
    readonly width: number;
}

declare var ImageData: {
    prototype: ImageData;
    new(sw: number, sh: number, settings?: ImageDataSettings): ImageData;
    new(data: Uint8ClampedArray, sw: number, sh?: number, settings?: ImageDataSettings): ImageData;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder)
 */
interface ImageDecoder {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder/complete) */
    readonly complete: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder/completed) */
    readonly completed: Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder/tracks) */
    readonly tracks: ImageTrackList;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder/type) */
    readonly type: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder/decode) */
    decode(options?: ImageDecodeOptions): Promise<ImageDecodeResult>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder/reset) */
    reset(): void;
}

declare var ImageDecoder: {
    prototype: ImageDecoder;
    new(init: ImageDecoderInit): ImageDecoder;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageDecoder/isTypeSupported_static) */
    isTypeSupported(type: string): Promise<boolean>;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrack) */
interface ImageTrack {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrack/animated) */
    readonly animated: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrack/frameCount) */
    readonly frameCount: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrack/repetitionCount) */
    readonly repetitionCount: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrack/selected) */
    selected: boolean;
}

declare var ImageTrack: {
    prototype: ImageTrack;
    new(): ImageTrack;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrackList) */
interface ImageTrackList {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrackList/length) */
    readonly length: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrackList/ready) */
    readonly ready: Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrackList/selectedIndex) */
    readonly selectedIndex: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ImageTrackList/selectedTrack) */
    readonly selectedTrack: ImageTrack | null;
    [index: number]: ImageTrack;
}

declare var ImageTrackList: {
    prototype: ImageTrackList;
    new(): ImageTrackList;
};

interface ImportMeta {
    url: string;
    resolve(specifier: string): string;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/KHR_parallel_shader_compile) */
interface KHR_parallel_shader_compile {
    readonly COMPLETION_STATUS_KHR: 0x91B1;
}

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Lock)
 */
interface Lock {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Lock/mode) */
    readonly mode: LockMode;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Lock/name) */
    readonly name: string;
}

declare var Lock: {
    prototype: Lock;
    new(): Lock;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/LockManager)
 */
interface LockManager {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/LockManager/query) */
    query(): Promise<LockManagerSnapshot>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/LockManager/request) */
    request(name: string, callback: LockGrantedCallback): Promise<any>;
    request(name: string, options: LockOptions, callback: LockGrantedCallback): Promise<any>;
}

declare var LockManager: {
    prototype: LockManager;
    new(): LockManager;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/MediaCapabilities) */
interface MediaCapabilities {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/MediaCapabilities/decodingInfo) */
    decodingInfo(configuration: MediaDecodingConfiguration): Promise<MediaCapabilitiesDecodingInfo>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/MediaCapabilities/encodingInfo) */
    encodingInfo(configuration: MediaEncodingConfiguration): Promise<MediaCapabilitiesEncodingInfo>;
}

declare var MediaCapabilities: {
    prototype: MediaCapabilities;
    new(): MediaCapabilities;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/MediaSourceHandle) */
interface MediaSourceHandle {
}

declare var MediaSourceHandle: {
    prototype: MediaSourceHandle;
    new(): MediaSourceHandle;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/MediaStreamTrackProcessor) */
interface MediaStreamTrackProcessor {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/MediaStreamTrackProcessor/readable) */
    readonly readable: ReadableStream;
}

declare var MediaStreamTrackProcessor: {
    prototype: MediaStreamTrackProcessor;
    new(init: MediaStreamTrackProcessorInit): MediaStreamTrackProcessor;
};

/**
 * This Channel Messaging API interface allows us to create a new message channel and send data through it via its two MessagePort properties.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageChannel)
 */
interface MessageChannel {
    /**
     * Returns the first MessagePort object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageChannel/port1)
     */
    readonly port1: MessagePort;
    /**
     * Returns the second MessagePort object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageChannel/port2)
     */
    readonly port2: MessagePort;
}

declare var MessageChannel: {
    prototype: MessageChannel;
    new(): MessageChannel;
};

/**
 * A message received by a target object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageEvent)
 */
interface MessageEvent<T = any> extends Event {
    /**
     * Returns the data of the message.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageEvent/data)
     */
    readonly data: T;
    /**
     * Returns the last event ID string, for server-sent events.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageEvent/lastEventId)
     */
    readonly lastEventId: string;
    /**
     * Returns the origin of the message, for server-sent events and cross-document messaging.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageEvent/origin)
     */
    readonly origin: string;
    /**
     * Returns the MessagePort array sent with the message, for cross-document messaging and channel messaging.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageEvent/ports)
     */
    readonly ports: ReadonlyArray<MessagePort>;
    /**
     * Returns the WindowProxy of the source window, for cross-document messaging, and the MessagePort being attached, in the connect event fired at SharedWorkerGlobalScope objects.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessageEvent/source)
     */
    readonly source: MessageEventSource | null;
    /** @deprecated */
    initMessageEvent(type: string, bubbles?: boolean, cancelable?: boolean, data?: any, origin?: string, lastEventId?: string, source?: MessageEventSource | null, ports?: MessagePort[]): void;
}

declare var MessageEvent: {
    prototype: MessageEvent;
    new<T>(type: string, eventInitDict?: MessageEventInit<T>): MessageEvent<T>;
};

interface MessageEventTargetEventMap {
    "message": MessageEvent;
    "messageerror": MessageEvent;
}

interface MessageEventTarget<T> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/message_event) */
    onmessage: ((this: T, ev: MessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/messageerror_event) */
    onmessageerror: ((this: T, ev: MessageEvent) => any) | null;
    addEventListener<K extends keyof MessageEventTargetEventMap>(type: K, listener: (this: T, ev: MessageEventTargetEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof MessageEventTargetEventMap>(type: K, listener: (this: T, ev: MessageEventTargetEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

interface MessagePortEventMap extends MessageEventTargetEventMap {
    "message": MessageEvent;
    "messageerror": MessageEvent;
}

/**
 * This Channel Messaging API interface represents one of the two ports of a MessageChannel, allowing messages to be sent from one port and listening out for them arriving at the other.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessagePort)
 */
interface MessagePort extends EventTarget, MessageEventTarget<MessagePort> {
    /**
     * Disconnects the port, so that it is no longer active.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessagePort/close)
     */
    close(): void;
    /**
     * Posts a message through the channel. Objects listed in transfer are transferred, not just cloned, meaning that they are no longer usable on the sending side.
     *
     * Throws a "DataCloneError" DOMException if transfer contains duplicate objects or port, or if message could not be cloned.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessagePort/postMessage)
     */
    postMessage(message: any, transfer: Transferable[]): void;
    postMessage(message: any, options?: StructuredSerializeOptions): void;
    /**
     * Begins dispatching messages received on the port.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/MessagePort/start)
     */
    start(): void;
    addEventListener<K extends keyof MessagePortEventMap>(type: K, listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof MessagePortEventMap>(type: K, listener: (this: MessagePort, ev: MessagePortEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var MessagePort: {
    prototype: MessagePort;
    new(): MessagePort;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/NavigationPreloadManager)
 */
interface NavigationPreloadManager {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/NavigationPreloadManager/disable) */
    disable(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/NavigationPreloadManager/enable) */
    enable(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/NavigationPreloadManager/getState) */
    getState(): Promise<NavigationPreloadState>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/NavigationPreloadManager/setHeaderValue) */
    setHeaderValue(value: string): Promise<void>;
}

declare var NavigationPreloadManager: {
    prototype: NavigationPreloadManager;
    new(): NavigationPreloadManager;
};

/** Available only in secure contexts. */
interface NavigatorBadge {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/clearAppBadge) */
    clearAppBadge(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/setAppBadge) */
    setAppBadge(contents?: number): Promise<void>;
}

interface NavigatorConcurrentHardware {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/hardwareConcurrency) */
    readonly hardwareConcurrency: number;
}

interface NavigatorID {
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/appCodeName)
     */
    readonly appCodeName: string;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/appName)
     */
    readonly appName: string;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/appVersion)
     */
    readonly appVersion: string;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/platform)
     */
    readonly platform: string;
    /**
     * @deprecated
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/product)
     */
    readonly product: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/userAgent) */
    readonly userAgent: string;
}

interface NavigatorLanguage {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/language) */
    readonly language: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/languages) */
    readonly languages: ReadonlyArray<string>;
}

/** Available only in secure contexts. */
interface NavigatorLocks {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/locks) */
    readonly locks: LockManager;
}

interface NavigatorOnLine {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/onLine) */
    readonly onLine: boolean;
}

/** Available only in secure contexts. */
interface NavigatorStorage {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Navigator/storage) */
    readonly storage: StorageManager;
}

interface NotificationEventMap {
    "click": Event;
    "close": Event;
    "error": Event;
    "show": Event;
}

/**
 * This Notifications API interface is used to configure and display desktop notifications to the user.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification)
 */
interface Notification extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/badge) */
    readonly badge: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/body) */
    readonly body: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/data) */
    readonly data: any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/dir) */
    readonly dir: NotificationDirection;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/icon) */
    readonly icon: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/lang) */
    readonly lang: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/click_event) */
    onclick: ((this: Notification, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/close_event) */
    onclose: ((this: Notification, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/error_event) */
    onerror: ((this: Notification, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/show_event) */
    onshow: ((this: Notification, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/requireInteraction) */
    readonly requireInteraction: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/silent) */
    readonly silent: boolean | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/tag) */
    readonly tag: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/title) */
    readonly title: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/close) */
    close(): void;
    addEventListener<K extends keyof NotificationEventMap>(type: K, listener: (this: Notification, ev: NotificationEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof NotificationEventMap>(type: K, listener: (this: Notification, ev: NotificationEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var Notification: {
    prototype: Notification;
    new(title: string, options?: NotificationOptions): Notification;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Notification/permission_static) */
    readonly permission: NotificationPermission;
};

/**
 * The parameter passed into the onnotificationclick handler, the NotificationEvent interface represents a notification click event that is dispatched on the ServiceWorkerGlobalScope of a ServiceWorker.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/NotificationEvent)
 */
interface NotificationEvent extends ExtendableEvent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/NotificationEvent/action) */
    readonly action: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/NotificationEvent/notification) */
    readonly notification: Notification;
}

declare var NotificationEvent: {
    prototype: NotificationEvent;
    new(type: string, eventInitDict: NotificationEventInit): NotificationEvent;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_draw_buffers_indexed) */
interface OES_draw_buffers_indexed {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_draw_buffers_indexed/blendEquationSeparateiOES) */
    blendEquationSeparateiOES(buf: GLuint, modeRGB: GLenum, modeAlpha: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_draw_buffers_indexed/blendEquationiOES) */
    blendEquationiOES(buf: GLuint, mode: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_draw_buffers_indexed/blendFuncSeparateiOES) */
    blendFuncSeparateiOES(buf: GLuint, srcRGB: GLenum, dstRGB: GLenum, srcAlpha: GLenum, dstAlpha: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_draw_buffers_indexed/blendFunciOES) */
    blendFunciOES(buf: GLuint, src: GLenum, dst: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_draw_buffers_indexed/colorMaskiOES) */
    colorMaskiOES(buf: GLuint, r: GLboolean, g: GLboolean, b: GLboolean, a: GLboolean): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_draw_buffers_indexed/disableiOES) */
    disableiOES(target: GLenum, index: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_draw_buffers_indexed/enableiOES) */
    enableiOES(target: GLenum, index: GLuint): void;
}

/**
 * The OES_element_index_uint extension is part of the WebGL API and adds support for gl.UNSIGNED_INT types to WebGLRenderingContext.drawElements().
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_element_index_uint)
 */
interface OES_element_index_uint {
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_fbo_render_mipmap) */
interface OES_fbo_render_mipmap {
}

/**
 * The OES_standard_derivatives extension is part of the WebGL API and adds the GLSL derivative functions dFdx, dFdy, and fwidth.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_standard_derivatives)
 */
interface OES_standard_derivatives {
    readonly FRAGMENT_SHADER_DERIVATIVE_HINT_OES: 0x8B8B;
}

/**
 * The OES_texture_float extension is part of the WebGL API and exposes floating-point pixel types for textures.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_texture_float)
 */
interface OES_texture_float {
}

/**
 * The OES_texture_float_linear extension is part of the WebGL API and allows linear filtering with floating-point pixel types for textures.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_texture_float_linear)
 */
interface OES_texture_float_linear {
}

/**
 * The OES_texture_half_float extension is part of the WebGL API and adds texture formats with 16- (aka half float) and 32-bit floating-point components.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_texture_half_float)
 */
interface OES_texture_half_float {
    readonly HALF_FLOAT_OES: 0x8D61;
}

/**
 * The OES_texture_half_float_linear extension is part of the WebGL API and allows linear filtering with half floating-point pixel types for textures.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_texture_half_float_linear)
 */
interface OES_texture_half_float_linear {
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_vertex_array_object) */
interface OES_vertex_array_object {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_vertex_array_object/bindVertexArrayOES) */
    bindVertexArrayOES(arrayObject: WebGLVertexArrayObjectOES | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_vertex_array_object/createVertexArrayOES) */
    createVertexArrayOES(): WebGLVertexArrayObjectOES;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_vertex_array_object/deleteVertexArrayOES) */
    deleteVertexArrayOES(arrayObject: WebGLVertexArrayObjectOES | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OES_vertex_array_object/isVertexArrayOES) */
    isVertexArrayOES(arrayObject: WebGLVertexArrayObjectOES | null): GLboolean;
    readonly VERTEX_ARRAY_BINDING_OES: 0x85B5;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OVR_multiview2) */
interface OVR_multiview2 {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OVR_multiview2/framebufferTextureMultiviewOVR) */
    framebufferTextureMultiviewOVR(target: GLenum, attachment: GLenum, texture: WebGLTexture | null, level: GLint, baseViewIndex: GLint, numViews: GLsizei): void;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_NUM_VIEWS_OVR: 0x9630;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_BASE_VIEW_INDEX_OVR: 0x9632;
    readonly MAX_VIEWS_OVR: 0x9631;
    readonly FRAMEBUFFER_INCOMPLETE_VIEW_TARGETS_OVR: 0x9633;
}

interface OffscreenCanvasEventMap {
    "contextlost": Event;
    "contextrestored": Event;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas) */
interface OffscreenCanvas extends EventTarget {
    /**
     * These attributes return the dimensions of the OffscreenCanvas object's bitmap.
     *
     * They can be set, to replace the bitmap with a new, transparent black bitmap of the specified dimensions (effectively resizing it).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas/height)
     */
    height: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas/contextlost_event) */
    oncontextlost: ((this: OffscreenCanvas, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas/contextrestored_event) */
    oncontextrestored: ((this: OffscreenCanvas, ev: Event) => any) | null;
    /**
     * These attributes return the dimensions of the OffscreenCanvas object's bitmap.
     *
     * They can be set, to replace the bitmap with a new, transparent black bitmap of the specified dimensions (effectively resizing it).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas/width)
     */
    width: number;
    /**
     * Returns a promise that will fulfill with a new Blob object representing a file containing the image in the OffscreenCanvas object.
     *
     * The argument, if provided, is a dictionary that controls the encoding options of the image file to be created. The type field specifies the file format and has a default value of "image/png"; that type is also used if the requested type isn't supported. If the image format supports variable quality (such as "image/jpeg"), then the quality field is a number in the range 0.0 to 1.0 inclusive indicating the desired quality level for the resulting image.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas/convertToBlob)
     */
    convertToBlob(options?: ImageEncodeOptions): Promise<Blob>;
    /**
     * Returns an object that exposes an API for drawing on the OffscreenCanvas object. contextId specifies the desired API: "2d", "bitmaprenderer", "webgl", or "webgl2". options is handled by that API.
     *
     * This specification defines the "2d" context below, which is similar but distinct from the "2d" context that is created from a canvas element. The WebGL specifications define the "webgl" and "webgl2" contexts. [WEBGL]
     *
     * Returns null if the canvas has already been initialized with another context type (e.g., trying to get a "2d" context after getting a "webgl" context).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas/getContext)
     */
    getContext(contextId: "2d", options?: any): OffscreenCanvasRenderingContext2D | null;
    getContext(contextId: "bitmaprenderer", options?: any): ImageBitmapRenderingContext | null;
    getContext(contextId: "webgl", options?: any): WebGLRenderingContext | null;
    getContext(contextId: "webgl2", options?: any): WebGL2RenderingContext | null;
    getContext(contextId: OffscreenRenderingContextId, options?: any): OffscreenRenderingContext | null;
    /**
     * Returns a newly created ImageBitmap object with the image in the OffscreenCanvas object. The image in the OffscreenCanvas object is replaced with a new blank image.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvas/transferToImageBitmap)
     */
    transferToImageBitmap(): ImageBitmap;
    addEventListener<K extends keyof OffscreenCanvasEventMap>(type: K, listener: (this: OffscreenCanvas, ev: OffscreenCanvasEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof OffscreenCanvasEventMap>(type: K, listener: (this: OffscreenCanvas, ev: OffscreenCanvasEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var OffscreenCanvas: {
    prototype: OffscreenCanvas;
    new(width: number, height: number): OffscreenCanvas;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/OffscreenCanvasRenderingContext2D) */
interface OffscreenCanvasRenderingContext2D extends CanvasCompositing, CanvasDrawImage, CanvasDrawPath, CanvasFillStrokeStyles, CanvasFilters, CanvasImageData, CanvasImageSmoothing, CanvasPath, CanvasPathDrawingStyles, CanvasRect, CanvasShadowStyles, CanvasState, CanvasText, CanvasTextDrawingStyles, CanvasTransform {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/canvas) */
    readonly canvas: OffscreenCanvas;
}

declare var OffscreenCanvasRenderingContext2D: {
    prototype: OffscreenCanvasRenderingContext2D;
    new(): OffscreenCanvasRenderingContext2D;
};

/**
 * This Canvas 2D API interface is used to declare a path that can then be used on a CanvasRenderingContext2D object. The path methods of the CanvasRenderingContext2D interface are also present on this interface, which gives you the convenience of being able to retain and replay your path whenever desired.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Path2D)
 */
interface Path2D extends CanvasPath {
    /**
     * Adds to the path the path given by the argument.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Path2D/addPath)
     */
    addPath(path: Path2D, transform?: DOMMatrix2DInit): void;
}

declare var Path2D: {
    prototype: Path2D;
    new(path?: Path2D | string): Path2D;
};

interface PerformanceEventMap {
    "resourcetimingbufferfull": Event;
}

/**
 * Provides access to performance-related information for the current page. It's part of the High Resolution Time API, but is enhanced by the Performance Timeline API, the Navigation Timing API, the User Timing API, and the Resource Timing API.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance)
 */
interface Performance extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/resourcetimingbufferfull_event) */
    onresourcetimingbufferfull: ((this: Performance, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/timeOrigin) */
    readonly timeOrigin: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/clearMarks) */
    clearMarks(markName?: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/clearMeasures) */
    clearMeasures(measureName?: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/clearResourceTimings) */
    clearResourceTimings(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/getEntries) */
    getEntries(): PerformanceEntryList;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/getEntriesByName) */
    getEntriesByName(name: string, type?: string): PerformanceEntryList;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/getEntriesByType) */
    getEntriesByType(type: string): PerformanceEntryList;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/mark) */
    mark(markName: string, markOptions?: PerformanceMarkOptions): PerformanceMark;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/measure) */
    measure(measureName: string, startOrMeasureOptions?: string | PerformanceMeasureOptions, endMark?: string): PerformanceMeasure;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/now) */
    now(): DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/setResourceTimingBufferSize) */
    setResourceTimingBufferSize(maxSize: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Performance/toJSON) */
    toJSON(): any;
    addEventListener<K extends keyof PerformanceEventMap>(type: K, listener: (this: Performance, ev: PerformanceEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof PerformanceEventMap>(type: K, listener: (this: Performance, ev: PerformanceEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var Performance: {
    prototype: Performance;
    new(): Performance;
};

/**
 * Encapsulates a single performance metric that is part of the performance timeline. A performance entry can be directly created by making a performance mark or measure (for example by calling the mark() method) at an explicit point in an application. Performance entries are also created in indirect ways such as loading a resource (such as an image).
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceEntry)
 */
interface PerformanceEntry {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceEntry/duration) */
    readonly duration: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceEntry/entryType) */
    readonly entryType: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceEntry/name) */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceEntry/startTime) */
    readonly startTime: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceEntry/toJSON) */
    toJSON(): any;
}

declare var PerformanceEntry: {
    prototype: PerformanceEntry;
    new(): PerformanceEntry;
};

/**
 * PerformanceMark is an abstract interface for PerformanceEntry objects with an entryType of "mark". Entries of this type are created by calling performance.mark() to add a named DOMHighResTimeStamp (the mark) to the browser's performance timeline.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceMark)
 */
interface PerformanceMark extends PerformanceEntry {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceMark/detail) */
    readonly detail: any;
}

declare var PerformanceMark: {
    prototype: PerformanceMark;
    new(markName: string, markOptions?: PerformanceMarkOptions): PerformanceMark;
};

/**
 * PerformanceMeasure is an abstract interface for PerformanceEntry objects with an entryType of "measure". Entries of this type are created by calling performance.measure() to add a named DOMHighResTimeStamp (the measure) between two marks to the browser's performance timeline.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceMeasure)
 */
interface PerformanceMeasure extends PerformanceEntry {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceMeasure/detail) */
    readonly detail: any;
}

declare var PerformanceMeasure: {
    prototype: PerformanceMeasure;
    new(): PerformanceMeasure;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserver) */
interface PerformanceObserver {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserver/disconnect) */
    disconnect(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserver/observe) */
    observe(options?: PerformanceObserverInit): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserver/takeRecords) */
    takeRecords(): PerformanceEntryList;
}

declare var PerformanceObserver: {
    prototype: PerformanceObserver;
    new(callback: PerformanceObserverCallback): PerformanceObserver;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserver/supportedEntryTypes_static) */
    readonly supportedEntryTypes: ReadonlyArray<string>;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserverEntryList) */
interface PerformanceObserverEntryList {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserverEntryList/getEntries) */
    getEntries(): PerformanceEntryList;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserverEntryList/getEntriesByName) */
    getEntriesByName(name: string, type?: string): PerformanceEntryList;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceObserverEntryList/getEntriesByType) */
    getEntriesByType(type: string): PerformanceEntryList;
}

declare var PerformanceObserverEntryList: {
    prototype: PerformanceObserverEntryList;
    new(): PerformanceObserverEntryList;
};

/**
 * Enables retrieval and analysis of detailed network timing data regarding the loading of an application's resources. An application can use the timing metrics to determine, for example, the length of time it takes to fetch a specific resource, such as an XMLHttpRequest, <SVG>, image, or script.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming)
 */
interface PerformanceResourceTiming extends PerformanceEntry {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/connectEnd) */
    readonly connectEnd: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/connectStart) */
    readonly connectStart: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/decodedBodySize) */
    readonly decodedBodySize: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/domainLookupEnd) */
    readonly domainLookupEnd: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/domainLookupStart) */
    readonly domainLookupStart: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/encodedBodySize) */
    readonly encodedBodySize: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/fetchStart) */
    readonly fetchStart: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/initiatorType) */
    readonly initiatorType: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/nextHopProtocol) */
    readonly nextHopProtocol: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/redirectEnd) */
    readonly redirectEnd: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/redirectStart) */
    readonly redirectStart: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/requestStart) */
    readonly requestStart: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/responseEnd) */
    readonly responseEnd: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/responseStart) */
    readonly responseStart: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/responseStatus) */
    readonly responseStatus: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/secureConnectionStart) */
    readonly secureConnectionStart: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/serverTiming) */
    readonly serverTiming: ReadonlyArray<PerformanceServerTiming>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/transferSize) */
    readonly transferSize: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/workerStart) */
    readonly workerStart: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceResourceTiming/toJSON) */
    toJSON(): any;
}

declare var PerformanceResourceTiming: {
    prototype: PerformanceResourceTiming;
    new(): PerformanceResourceTiming;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceServerTiming) */
interface PerformanceServerTiming {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceServerTiming/description) */
    readonly description: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceServerTiming/duration) */
    readonly duration: DOMHighResTimeStamp;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceServerTiming/name) */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PerformanceServerTiming/toJSON) */
    toJSON(): any;
}

declare var PerformanceServerTiming: {
    prototype: PerformanceServerTiming;
    new(): PerformanceServerTiming;
};

interface PermissionStatusEventMap {
    "change": Event;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PermissionStatus) */
interface PermissionStatus extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PermissionStatus/name) */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PermissionStatus/change_event) */
    onchange: ((this: PermissionStatus, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PermissionStatus/state) */
    readonly state: PermissionState;
    addEventListener<K extends keyof PermissionStatusEventMap>(type: K, listener: (this: PermissionStatus, ev: PermissionStatusEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof PermissionStatusEventMap>(type: K, listener: (this: PermissionStatus, ev: PermissionStatusEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var PermissionStatus: {
    prototype: PermissionStatus;
    new(): PermissionStatus;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Permissions) */
interface Permissions {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Permissions/query) */
    query(permissionDesc: PermissionDescriptor): Promise<PermissionStatus>;
}

declare var Permissions: {
    prototype: Permissions;
    new(): Permissions;
};

/**
 * Events measuring progress of an underlying process, like an HTTP request (for an XMLHttpRequest, or the loading of the underlying resource of an <img>, <audio>, <video>, <style> or <link>).
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ProgressEvent)
 */
interface ProgressEvent<T extends EventTarget = EventTarget> extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ProgressEvent/lengthComputable) */
    readonly lengthComputable: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ProgressEvent/loaded) */
    readonly loaded: number;
    readonly target: T | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ProgressEvent/total) */
    readonly total: number;
}

declare var ProgressEvent: {
    prototype: ProgressEvent;
    new(type: string, eventInitDict?: ProgressEventInit): ProgressEvent;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PromiseRejectionEvent) */
interface PromiseRejectionEvent extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PromiseRejectionEvent/promise) */
    readonly promise: Promise<any>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PromiseRejectionEvent/reason) */
    readonly reason: any;
}

declare var PromiseRejectionEvent: {
    prototype: PromiseRejectionEvent;
    new(type: string, eventInitDict: PromiseRejectionEventInit): PromiseRejectionEvent;
};

/**
 * This Push API interface represents a push message that has been received. This event is sent to the global scope of a ServiceWorker. It contains the information sent from an application server to a PushSubscription.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushEvent)
 */
interface PushEvent extends ExtendableEvent {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushEvent/data) */
    readonly data: PushMessageData | null;
}

declare var PushEvent: {
    prototype: PushEvent;
    new(type: string, eventInitDict?: PushEventInit): PushEvent;
};

/**
 * This Push API interface provides a way to receive notifications from third-party servers as well as request URLs for push notifications.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushManager)
 */
interface PushManager {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushManager/getSubscription) */
    getSubscription(): Promise<PushSubscription | null>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushManager/permissionState) */
    permissionState(options?: PushSubscriptionOptionsInit): Promise<PermissionState>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushManager/subscribe) */
    subscribe(options?: PushSubscriptionOptionsInit): Promise<PushSubscription>;
}

declare var PushManager: {
    prototype: PushManager;
    new(): PushManager;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushManager/supportedContentEncodings_static) */
    readonly supportedContentEncodings: ReadonlyArray<string>;
};

/**
 * This Push API interface provides methods which let you retrieve the push data sent by a server in various formats.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushMessageData)
 */
interface PushMessageData {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushMessageData/arrayBuffer) */
    arrayBuffer(): ArrayBuffer;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushMessageData/blob) */
    blob(): Blob;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushMessageData/bytes) */
    bytes(): Uint8Array;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushMessageData/json) */
    json(): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushMessageData/text) */
    text(): string;
}

declare var PushMessageData: {
    prototype: PushMessageData;
    new(): PushMessageData;
};

/**
 * This Push API interface provides a subcription's URL endpoint and allows unsubscription from a push service.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscription)
 */
interface PushSubscription {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscription/endpoint) */
    readonly endpoint: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscription/expirationTime) */
    readonly expirationTime: EpochTimeStamp | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscription/options) */
    readonly options: PushSubscriptionOptions;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscription/getKey) */
    getKey(name: PushEncryptionKeyName): ArrayBuffer | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscription/toJSON) */
    toJSON(): PushSubscriptionJSON;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscription/unsubscribe) */
    unsubscribe(): Promise<boolean>;
}

declare var PushSubscription: {
    prototype: PushSubscription;
    new(): PushSubscription;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscriptionOptions)
 */
interface PushSubscriptionOptions {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscriptionOptions/applicationServerKey) */
    readonly applicationServerKey: ArrayBuffer | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/PushSubscriptionOptions/userVisibleOnly) */
    readonly userVisibleOnly: boolean;
}

declare var PushSubscriptionOptions: {
    prototype: PushSubscriptionOptions;
    new(): PushSubscriptionOptions;
};

interface RTCDataChannelEventMap {
    "bufferedamountlow": Event;
    "close": Event;
    "closing": Event;
    "error": Event;
    "message": MessageEvent;
    "open": Event;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel) */
interface RTCDataChannel extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/binaryType) */
    binaryType: BinaryType;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/bufferedAmount) */
    readonly bufferedAmount: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/bufferedAmountLowThreshold) */
    bufferedAmountLowThreshold: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/id) */
    readonly id: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/label) */
    readonly label: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/maxPacketLifeTime) */
    readonly maxPacketLifeTime: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/maxRetransmits) */
    readonly maxRetransmits: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/negotiated) */
    readonly negotiated: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/bufferedamountlow_event) */
    onbufferedamountlow: ((this: RTCDataChannel, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/close_event) */
    onclose: ((this: RTCDataChannel, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/closing_event) */
    onclosing: ((this: RTCDataChannel, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/error_event) */
    onerror: ((this: RTCDataChannel, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/message_event) */
    onmessage: ((this: RTCDataChannel, ev: MessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/open_event) */
    onopen: ((this: RTCDataChannel, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/ordered) */
    readonly ordered: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/protocol) */
    readonly protocol: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/readyState) */
    readonly readyState: RTCDataChannelState;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCDataChannel/send) */
    send(data: string): void;
    send(data: Blob): void;
    send(data: ArrayBuffer): void;
    send(data: ArrayBufferView): void;
    addEventListener<K extends keyof RTCDataChannelEventMap>(type: K, listener: (this: RTCDataChannel, ev: RTCDataChannelEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof RTCDataChannelEventMap>(type: K, listener: (this: RTCDataChannel, ev: RTCDataChannelEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var RTCDataChannel: {
    prototype: RTCDataChannel;
    new(): RTCDataChannel;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedAudioFrame) */
interface RTCEncodedAudioFrame {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedAudioFrame/data) */
    data: ArrayBuffer;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedAudioFrame/timestamp) */
    readonly timestamp: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedAudioFrame/getMetadata) */
    getMetadata(): RTCEncodedAudioFrameMetadata;
}

declare var RTCEncodedAudioFrame: {
    prototype: RTCEncodedAudioFrame;
    new(): RTCEncodedAudioFrame;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedVideoFrame) */
interface RTCEncodedVideoFrame {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedVideoFrame/data) */
    data: ArrayBuffer;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedVideoFrame/timestamp) */
    readonly timestamp: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedVideoFrame/type) */
    readonly type: RTCEncodedVideoFrameType;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCEncodedVideoFrame/getMetadata) */
    getMetadata(): RTCEncodedVideoFrameMetadata;
}

declare var RTCEncodedVideoFrame: {
    prototype: RTCEncodedVideoFrame;
    new(): RTCEncodedVideoFrame;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCRtpScriptTransformer) */
interface RTCRtpScriptTransformer extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCRtpScriptTransformer/options) */
    readonly options: any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCRtpScriptTransformer/readable) */
    readonly readable: ReadableStream;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCRtpScriptTransformer/writable) */
    readonly writable: WritableStream;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCRtpScriptTransformer/generateKeyFrame) */
    generateKeyFrame(rid?: string): Promise<number>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCRtpScriptTransformer/sendKeyFrameRequest) */
    sendKeyFrameRequest(): Promise<void>;
}

declare var RTCRtpScriptTransformer: {
    prototype: RTCRtpScriptTransformer;
    new(): RTCRtpScriptTransformer;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCTransformEvent) */
interface RTCTransformEvent extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/RTCTransformEvent/transformer) */
    readonly transformer: RTCRtpScriptTransformer;
}

declare var RTCTransformEvent: {
    prototype: RTCTransformEvent;
    new(): RTCTransformEvent;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController) */
interface ReadableByteStreamController {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/byobRequest) */
    readonly byobRequest: ReadableStreamBYOBRequest | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/desiredSize) */
    readonly desiredSize: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/enqueue) */
    enqueue(chunk: ArrayBufferView): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableByteStreamController/error) */
    error(e?: any): void;
}

declare var ReadableByteStreamController: {
    prototype: ReadableByteStreamController;
    new(): ReadableByteStreamController;
};

/**
 * This Streams API interface represents a readable stream of byte data. The Fetch API offers a concrete instance of a ReadableStream through the body property of a Response object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream)
 */
interface ReadableStream<R = any> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/locked) */
    readonly locked: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/cancel) */
    cancel(reason?: any): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/getReader) */
    getReader(options: { mode: "byob" }): ReadableStreamBYOBReader;
    getReader(): ReadableStreamDefaultReader<R>;
    getReader(options?: ReadableStreamGetReaderOptions): ReadableStreamReader<R>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/pipeThrough) */
    pipeThrough<T>(transform: ReadableWritablePair<T, R>, options?: StreamPipeOptions): ReadableStream<T>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/pipeTo) */
    pipeTo(destination: WritableStream<R>, options?: StreamPipeOptions): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStream/tee) */
    tee(): [ReadableStream<R>, ReadableStream<R>];
}

declare var ReadableStream: {
    prototype: ReadableStream;
    new(underlyingSource: UnderlyingByteSource, strategy?: { highWaterMark?: number }): ReadableStream<Uint8Array>;
    new<R = any>(underlyingSource: UnderlyingDefaultSource<R>, strategy?: QueuingStrategy<R>): ReadableStream<R>;
    new<R = any>(underlyingSource?: UnderlyingSource<R>, strategy?: QueuingStrategy<R>): ReadableStream<R>;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBReader) */
interface ReadableStreamBYOBReader extends ReadableStreamGenericReader {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBReader/read) */
    read<T extends ArrayBufferView>(view: T): Promise<ReadableStreamReadResult<T>>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBReader/releaseLock) */
    releaseLock(): void;
}

declare var ReadableStreamBYOBReader: {
    prototype: ReadableStreamBYOBReader;
    new(stream: ReadableStream<Uint8Array>): ReadableStreamBYOBReader;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBRequest) */
interface ReadableStreamBYOBRequest {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBRequest/view) */
    readonly view: ArrayBufferView | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBRequest/respond) */
    respond(bytesWritten: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBRequest/respondWithNewView) */
    respondWithNewView(view: ArrayBufferView): void;
}

declare var ReadableStreamBYOBRequest: {
    prototype: ReadableStreamBYOBRequest;
    new(): ReadableStreamBYOBRequest;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController) */
interface ReadableStreamDefaultController<R = any> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController/desiredSize) */
    readonly desiredSize: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController/enqueue) */
    enqueue(chunk?: R): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultController/error) */
    error(e?: any): void;
}

declare var ReadableStreamDefaultController: {
    prototype: ReadableStreamDefaultController;
    new(): ReadableStreamDefaultController;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultReader) */
interface ReadableStreamDefaultReader<R = any> extends ReadableStreamGenericReader {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultReader/read) */
    read(): Promise<ReadableStreamReadResult<R>>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamDefaultReader/releaseLock) */
    releaseLock(): void;
}

declare var ReadableStreamDefaultReader: {
    prototype: ReadableStreamDefaultReader;
    new<R = any>(stream: ReadableStream<R>): ReadableStreamDefaultReader<R>;
};

interface ReadableStreamGenericReader {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBReader/closed) */
    readonly closed: Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReadableStreamBYOBReader/cancel) */
    cancel(reason?: any): Promise<void>;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Report) */
interface Report {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Report/body) */
    readonly body: ReportBody | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Report/type) */
    readonly type: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Report/url) */
    readonly url: string;
    toJSON(): any;
}

declare var Report: {
    prototype: Report;
    new(): Report;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReportBody) */
interface ReportBody {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReportBody/toJSON) */
    toJSON(): any;
}

declare var ReportBody: {
    prototype: ReportBody;
    new(): ReportBody;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReportingObserver) */
interface ReportingObserver {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReportingObserver/disconnect) */
    disconnect(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReportingObserver/observe) */
    observe(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ReportingObserver/takeRecords) */
    takeRecords(): ReportList;
}

declare var ReportingObserver: {
    prototype: ReportingObserver;
    new(callback: ReportingObserverCallback, options?: ReportingObserverOptions): ReportingObserver;
};

/**
 * This Fetch API interface represents a resource request.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request)
 */
interface Request extends Body {
    /**
     * Returns the cache mode associated with request, which is a string indicating how the request will interact with the browser's cache when fetching.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/cache)
     */
    readonly cache: RequestCache;
    /**
     * Returns the credentials mode associated with request, which is a string indicating whether credentials will be sent with the request always, never, or only when sent to a same-origin URL.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/credentials)
     */
    readonly credentials: RequestCredentials;
    /**
     * Returns the kind of resource requested by request, e.g., "document" or "script".
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/destination)
     */
    readonly destination: RequestDestination;
    /**
     * Returns a Headers object consisting of the headers associated with request. Note that headers added in the network layer by the user agent will not be accounted for in this object, e.g., the "Host" header.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/headers)
     */
    readonly headers: Headers;
    /**
     * Returns request's subresource integrity metadata, which is a cryptographic hash of the resource being fetched. Its value consists of multiple hashes separated by whitespace. [SRI]
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/integrity)
     */
    readonly integrity: string;
    /**
     * Returns a boolean indicating whether or not request can outlive the global in which it was created.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/keepalive)
     */
    readonly keepalive: boolean;
    /**
     * Returns request's HTTP method, which is "GET" by default.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/method)
     */
    readonly method: string;
    /**
     * Returns the mode associated with request, which is a string indicating whether the request will use CORS, or will be restricted to same-origin URLs.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/mode)
     */
    readonly mode: RequestMode;
    /**
     * Returns the redirect mode associated with request, which is a string indicating how redirects for the request will be handled during fetching. A request will follow redirects by default.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/redirect)
     */
    readonly redirect: RequestRedirect;
    /**
     * Returns the referrer of request. Its value can be a same-origin URL if explicitly set in init, the empty string to indicate no referrer, and "about:client" when defaulting to the global's default. This is used during fetching to determine the value of the `Referer` header of the request being made.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/referrer)
     */
    readonly referrer: string;
    /**
     * Returns the referrer policy associated with request. This is used during fetching to compute the value of the request's referrer.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/referrerPolicy)
     */
    readonly referrerPolicy: ReferrerPolicy;
    /**
     * Returns the signal associated with request, which is an AbortSignal object indicating whether or not request has been aborted, and its abort event handler.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/signal)
     */
    readonly signal: AbortSignal;
    /**
     * Returns the URL of request as a string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/url)
     */
    readonly url: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Request/clone) */
    clone(): Request;
}

declare var Request: {
    prototype: Request;
    new(input: RequestInfo | URL, init?: RequestInit): Request;
};

/**
 * This Fetch API interface represents the response to a request.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response)
 */
interface Response extends Body {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/headers) */
    readonly headers: Headers;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/ok) */
    readonly ok: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/redirected) */
    readonly redirected: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/status) */
    readonly status: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/statusText) */
    readonly statusText: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/type) */
    readonly type: ResponseType;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/url) */
    readonly url: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/clone) */
    clone(): Response;
}

declare var Response: {
    prototype: Response;
    new(body?: BodyInit | null, init?: ResponseInit): Response;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/error_static) */
    error(): Response;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/json_static) */
    json(data: any, init?: ResponseInit): Response;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Response/redirect_static) */
    redirect(url: string | URL, status?: number): Response;
};

/**
 * Inherits from Event, and represents the event object of an event sent on a document or worker when its content security policy is violated.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent)
 */
interface SecurityPolicyViolationEvent extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/blockedURI) */
    readonly blockedURI: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/columnNumber) */
    readonly columnNumber: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/disposition) */
    readonly disposition: SecurityPolicyViolationEventDisposition;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/documentURI) */
    readonly documentURI: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/effectiveDirective) */
    readonly effectiveDirective: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/lineNumber) */
    readonly lineNumber: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/originalPolicy) */
    readonly originalPolicy: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/referrer) */
    readonly referrer: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/sample) */
    readonly sample: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/sourceFile) */
    readonly sourceFile: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/statusCode) */
    readonly statusCode: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SecurityPolicyViolationEvent/violatedDirective) */
    readonly violatedDirective: string;
}

declare var SecurityPolicyViolationEvent: {
    prototype: SecurityPolicyViolationEvent;
    new(type: string, eventInitDict?: SecurityPolicyViolationEventInit): SecurityPolicyViolationEvent;
};

interface ServiceWorkerEventMap extends AbstractWorkerEventMap {
    "statechange": Event;
}

/**
 * This ServiceWorker API interface provides a reference to a service worker. Multiple browsing contexts (e.g. pages, workers, etc.) can be associated with the same service worker, each through a unique ServiceWorker object.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorker)
 */
interface ServiceWorker extends EventTarget, AbstractWorker {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorker/statechange_event) */
    onstatechange: ((this: ServiceWorker, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorker/scriptURL) */
    readonly scriptURL: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorker/state) */
    readonly state: ServiceWorkerState;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorker/postMessage) */
    postMessage(message: any, transfer: Transferable[]): void;
    postMessage(message: any, options?: StructuredSerializeOptions): void;
    addEventListener<K extends keyof ServiceWorkerEventMap>(type: K, listener: (this: ServiceWorker, ev: ServiceWorkerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof ServiceWorkerEventMap>(type: K, listener: (this: ServiceWorker, ev: ServiceWorkerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var ServiceWorker: {
    prototype: ServiceWorker;
    new(): ServiceWorker;
};

interface ServiceWorkerContainerEventMap {
    "controllerchange": Event;
    "message": MessageEvent;
    "messageerror": MessageEvent;
}

/**
 * The ServiceWorkerContainer interface of the ServiceWorker API provides an object representing the service worker as an overall unit in the network ecosystem, including facilities to register, unregister and update service workers, and access the state of service workers and their registrations.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer)
 */
interface ServiceWorkerContainer extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/controller) */
    readonly controller: ServiceWorker | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/controllerchange_event) */
    oncontrollerchange: ((this: ServiceWorkerContainer, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/message_event) */
    onmessage: ((this: ServiceWorkerContainer, ev: MessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/messageerror_event) */
    onmessageerror: ((this: ServiceWorkerContainer, ev: MessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/ready) */
    readonly ready: Promise<ServiceWorkerRegistration>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/getRegistration) */
    getRegistration(clientURL?: string | URL): Promise<ServiceWorkerRegistration | undefined>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/getRegistrations) */
    getRegistrations(): Promise<ReadonlyArray<ServiceWorkerRegistration>>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/register) */
    register(scriptURL: string | URL, options?: RegistrationOptions): Promise<ServiceWorkerRegistration>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerContainer/startMessages) */
    startMessages(): void;
    addEventListener<K extends keyof ServiceWorkerContainerEventMap>(type: K, listener: (this: ServiceWorkerContainer, ev: ServiceWorkerContainerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof ServiceWorkerContainerEventMap>(type: K, listener: (this: ServiceWorkerContainer, ev: ServiceWorkerContainerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var ServiceWorkerContainer: {
    prototype: ServiceWorkerContainer;
    new(): ServiceWorkerContainer;
};

interface ServiceWorkerGlobalScopeEventMap extends WorkerGlobalScopeEventMap {
    "activate": ExtendableEvent;
    "fetch": FetchEvent;
    "install": ExtendableEvent;
    "message": ExtendableMessageEvent;
    "messageerror": MessageEvent;
    "notificationclick": NotificationEvent;
    "notificationclose": NotificationEvent;
    "push": PushEvent;
    "pushsubscriptionchange": Event;
}

/**
 * This ServiceWorker API interface represents the global execution context of a service worker.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope)
 */
interface ServiceWorkerGlobalScope extends WorkerGlobalScope {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/clients) */
    readonly clients: Clients;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/activate_event) */
    onactivate: ((this: ServiceWorkerGlobalScope, ev: ExtendableEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/fetch_event) */
    onfetch: ((this: ServiceWorkerGlobalScope, ev: FetchEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/install_event) */
    oninstall: ((this: ServiceWorkerGlobalScope, ev: ExtendableEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/message_event) */
    onmessage: ((this: ServiceWorkerGlobalScope, ev: ExtendableMessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/messageerror_event) */
    onmessageerror: ((this: ServiceWorkerGlobalScope, ev: MessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/notificationclick_event) */
    onnotificationclick: ((this: ServiceWorkerGlobalScope, ev: NotificationEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/notificationclose_event) */
    onnotificationclose: ((this: ServiceWorkerGlobalScope, ev: NotificationEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/push_event) */
    onpush: ((this: ServiceWorkerGlobalScope, ev: PushEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/pushsubscriptionchange_event) */
    onpushsubscriptionchange: ((this: ServiceWorkerGlobalScope, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/registration) */
    readonly registration: ServiceWorkerRegistration;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/serviceWorker) */
    readonly serviceWorker: ServiceWorker;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerGlobalScope/skipWaiting) */
    skipWaiting(): Promise<void>;
    addEventListener<K extends keyof ServiceWorkerGlobalScopeEventMap>(type: K, listener: (this: ServiceWorkerGlobalScope, ev: ServiceWorkerGlobalScopeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof ServiceWorkerGlobalScopeEventMap>(type: K, listener: (this: ServiceWorkerGlobalScope, ev: ServiceWorkerGlobalScopeEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var ServiceWorkerGlobalScope: {
    prototype: ServiceWorkerGlobalScope;
    new(): ServiceWorkerGlobalScope;
};

interface ServiceWorkerRegistrationEventMap {
    "updatefound": Event;
}

/**
 * This ServiceWorker API interface represents the service worker registration. You register a service worker to control one or more pages that share the same origin.
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration)
 */
interface ServiceWorkerRegistration extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/active) */
    readonly active: ServiceWorker | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/installing) */
    readonly installing: ServiceWorker | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/navigationPreload) */
    readonly navigationPreload: NavigationPreloadManager;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/updatefound_event) */
    onupdatefound: ((this: ServiceWorkerRegistration, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/pushManager) */
    readonly pushManager: PushManager;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/scope) */
    readonly scope: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/updateViaCache) */
    readonly updateViaCache: ServiceWorkerUpdateViaCache;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/waiting) */
    readonly waiting: ServiceWorker | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/getNotifications) */
    getNotifications(filter?: GetNotificationOptions): Promise<Notification[]>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/showNotification) */
    showNotification(title: string, options?: NotificationOptions): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/unregister) */
    unregister(): Promise<boolean>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/ServiceWorkerRegistration/update) */
    update(): Promise<void>;
    addEventListener<K extends keyof ServiceWorkerRegistrationEventMap>(type: K, listener: (this: ServiceWorkerRegistration, ev: ServiceWorkerRegistrationEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof ServiceWorkerRegistrationEventMap>(type: K, listener: (this: ServiceWorkerRegistration, ev: ServiceWorkerRegistrationEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var ServiceWorkerRegistration: {
    prototype: ServiceWorkerRegistration;
    new(): ServiceWorkerRegistration;
};

interface SharedWorkerGlobalScopeEventMap extends WorkerGlobalScopeEventMap {
    "connect": MessageEvent;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SharedWorkerGlobalScope) */
interface SharedWorkerGlobalScope extends WorkerGlobalScope {
    /**
     * Returns sharedWorkerGlobal's name, i.e. the value given to the SharedWorker constructor. Multiple SharedWorker objects can correspond to the same shared worker (and SharedWorkerGlobalScope), by reusing the same name.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/SharedWorkerGlobalScope/name)
     */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SharedWorkerGlobalScope/connect_event) */
    onconnect: ((this: SharedWorkerGlobalScope, ev: MessageEvent) => any) | null;
    /**
     * Aborts sharedWorkerGlobal.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/SharedWorkerGlobalScope/close)
     */
    close(): void;
    addEventListener<K extends keyof SharedWorkerGlobalScopeEventMap>(type: K, listener: (this: SharedWorkerGlobalScope, ev: SharedWorkerGlobalScopeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof SharedWorkerGlobalScopeEventMap>(type: K, listener: (this: SharedWorkerGlobalScope, ev: SharedWorkerGlobalScopeEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var SharedWorkerGlobalScope: {
    prototype: SharedWorkerGlobalScope;
    new(): SharedWorkerGlobalScope;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/StorageManager)
 */
interface StorageManager {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/StorageManager/estimate) */
    estimate(): Promise<StorageEstimate>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/StorageManager/getDirectory) */
    getDirectory(): Promise<FileSystemDirectoryHandle>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/StorageManager/persisted) */
    persisted(): Promise<boolean>;
}

declare var StorageManager: {
    prototype: StorageManager;
    new(): StorageManager;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly) */
interface StylePropertyMapReadOnly {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/size) */
    readonly size: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/get) */
    get(property: string): undefined | CSSStyleValue;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/getAll) */
    getAll(property: string): CSSStyleValue[];
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/StylePropertyMapReadOnly/has) */
    has(property: string): boolean;
    forEach(callbackfn: (value: CSSStyleValue[], key: string, parent: StylePropertyMapReadOnly) => void, thisArg?: any): void;
}

declare var StylePropertyMapReadOnly: {
    prototype: StylePropertyMapReadOnly;
    new(): StylePropertyMapReadOnly;
};

/**
 * This Web Crypto API interface provides a number of low-level cryptographic functions. It is accessed via the Crypto.subtle properties available in a window context (via Window.crypto).
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto)
 */
interface SubtleCrypto {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/decrypt) */
    decrypt(algorithm: AlgorithmIdentifier | RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/deriveBits) */
    deriveBits(algorithm: AlgorithmIdentifier | EcdhKeyDeriveParams | HkdfParams | Pbkdf2Params, baseKey: CryptoKey, length?: number | null): Promise<ArrayBuffer>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/deriveKey) */
    deriveKey(algorithm: AlgorithmIdentifier | EcdhKeyDeriveParams | HkdfParams | Pbkdf2Params, baseKey: CryptoKey, derivedKeyType: AlgorithmIdentifier | AesDerivedKeyParams | HmacImportParams | HkdfParams | Pbkdf2Params, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/digest) */
    digest(algorithm: AlgorithmIdentifier, data: BufferSource): Promise<ArrayBuffer>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/encrypt) */
    encrypt(algorithm: AlgorithmIdentifier | RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/exportKey) */
    exportKey(format: "jwk", key: CryptoKey): Promise<JsonWebKey>;
    exportKey(format: Exclude<KeyFormat, "jwk">, key: CryptoKey): Promise<ArrayBuffer>;
    exportKey(format: KeyFormat, key: CryptoKey): Promise<ArrayBuffer | JsonWebKey>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/generateKey) */
    generateKey(algorithm: "Ed25519" | { name: "Ed25519" }, extractable: boolean, keyUsages: ReadonlyArray<"sign" | "verify">): Promise<CryptoKeyPair>;
    generateKey(algorithm: RsaHashedKeyGenParams | EcKeyGenParams, extractable: boolean, keyUsages: ReadonlyArray<KeyUsage>): Promise<CryptoKeyPair>;
    generateKey(algorithm: AesKeyGenParams | HmacKeyGenParams | Pbkdf2Params, extractable: boolean, keyUsages: ReadonlyArray<KeyUsage>): Promise<CryptoKey>;
    generateKey(algorithm: AlgorithmIdentifier, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKeyPair | CryptoKey>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/importKey) */
    importKey(format: "jwk", keyData: JsonWebKey, algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm, extractable: boolean, keyUsages: ReadonlyArray<KeyUsage>): Promise<CryptoKey>;
    importKey(format: Exclude<KeyFormat, "jwk">, keyData: BufferSource, algorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/sign) */
    sign(algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams, key: CryptoKey, data: BufferSource): Promise<ArrayBuffer>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/unwrapKey) */
    unwrapKey(format: KeyFormat, wrappedKey: BufferSource, unwrappingKey: CryptoKey, unwrapAlgorithm: AlgorithmIdentifier | RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams, unwrappedKeyAlgorithm: AlgorithmIdentifier | RsaHashedImportParams | EcKeyImportParams | HmacImportParams | AesKeyAlgorithm, extractable: boolean, keyUsages: KeyUsage[]): Promise<CryptoKey>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/verify) */
    verify(algorithm: AlgorithmIdentifier | RsaPssParams | EcdsaParams, key: CryptoKey, signature: BufferSource, data: BufferSource): Promise<boolean>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/SubtleCrypto/wrapKey) */
    wrapKey(format: KeyFormat, key: CryptoKey, wrappingKey: CryptoKey, wrapAlgorithm: AlgorithmIdentifier | RsaOaepParams | AesCtrParams | AesCbcParams | AesGcmParams): Promise<ArrayBuffer>;
}

declare var SubtleCrypto: {
    prototype: SubtleCrypto;
    new(): SubtleCrypto;
};

/**
 * A decoder for a specific method, that is a specific character encoding, like utf-8, iso-8859-2, koi8, cp1261, gbk, etc. A decoder takes a stream of bytes as input and emits a stream of code points. For a more scalable, non-native library, see StringView – a C-like representation of strings based on typed arrays.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoder)
 */
interface TextDecoder extends TextDecoderCommon {
    /**
     * Returns the result of running encoding's decoder. The method can be invoked zero or more times with options's stream set to true, and then once without options's stream (or set to false), to process a fragmented input. If the invocation without options's stream (or set to false) has no input, it's clearest to omit both arguments.
     *
     * ```
     * var string = "", decoder = new TextDecoder(encoding), buffer;
     * while(buffer = next_chunk()) {
     *   string += decoder.decode(buffer, {stream:true});
     * }
     * string += decoder.decode(); // end-of-queue
     * ```
     *
     * If the error mode is "fatal" and encoding's decoder returns error, throws a TypeError.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoder/decode)
     */
    decode(input?: AllowSharedBufferSource, options?: TextDecodeOptions): string;
}

declare var TextDecoder: {
    prototype: TextDecoder;
    new(label?: string, options?: TextDecoderOptions): TextDecoder;
};

interface TextDecoderCommon {
    /**
     * Returns encoding's name, lowercased.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoder/encoding)
     */
    readonly encoding: string;
    /**
     * Returns true if error mode is "fatal", otherwise false.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoder/fatal)
     */
    readonly fatal: boolean;
    /**
     * Returns the value of ignore BOM.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoder/ignoreBOM)
     */
    readonly ignoreBOM: boolean;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextDecoderStream) */
interface TextDecoderStream extends GenericTransformStream, TextDecoderCommon {
    readonly readable: ReadableStream<string>;
    readonly writable: WritableStream<BufferSource>;
}

declare var TextDecoderStream: {
    prototype: TextDecoderStream;
    new(label?: string, options?: TextDecoderOptions): TextDecoderStream;
};

/**
 * TextEncoder takes a stream of code points as input and emits a stream of bytes. For a more scalable, non-native library, see StringView – a C-like representation of strings based on typed arrays.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoder)
 */
interface TextEncoder extends TextEncoderCommon {
    /**
     * Returns the result of running UTF-8's encoder.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoder/encode)
     */
    encode(input?: string): Uint8Array;
    /**
     * Runs the UTF-8 encoder on source, stores the result of that operation into destination, and returns the progress made as an object wherein read is the number of converted code units of source and written is the number of bytes modified in destination.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoder/encodeInto)
     */
    encodeInto(source: string, destination: Uint8Array): TextEncoderEncodeIntoResult;
}

declare var TextEncoder: {
    prototype: TextEncoder;
    new(): TextEncoder;
};

interface TextEncoderCommon {
    /**
     * Returns "utf-8".
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoder/encoding)
     */
    readonly encoding: string;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextEncoderStream) */
interface TextEncoderStream extends GenericTransformStream, TextEncoderCommon {
    readonly readable: ReadableStream<Uint8Array>;
    readonly writable: WritableStream<string>;
}

declare var TextEncoderStream: {
    prototype: TextEncoderStream;
    new(): TextEncoderStream;
};

/**
 * The dimensions of a piece of text in the canvas, as created by the CanvasRenderingContext2D.measureText() method.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics)
 */
interface TextMetrics {
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/actualBoundingBoxAscent)
     */
    readonly actualBoundingBoxAscent: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/actualBoundingBoxDescent)
     */
    readonly actualBoundingBoxDescent: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/actualBoundingBoxLeft)
     */
    readonly actualBoundingBoxLeft: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/actualBoundingBoxRight)
     */
    readonly actualBoundingBoxRight: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/alphabeticBaseline)
     */
    readonly alphabeticBaseline: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/emHeightAscent)
     */
    readonly emHeightAscent: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/emHeightDescent)
     */
    readonly emHeightDescent: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/fontBoundingBoxAscent)
     */
    readonly fontBoundingBoxAscent: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/fontBoundingBoxDescent)
     */
    readonly fontBoundingBoxDescent: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/hangingBaseline)
     */
    readonly hangingBaseline: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/ideographicBaseline)
     */
    readonly ideographicBaseline: number;
    /**
     * Returns the measurement described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/TextMetrics/width)
     */
    readonly width: number;
}

declare var TextMetrics: {
    prototype: TextMetrics;
    new(): TextMetrics;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStream) */
interface TransformStream<I = any, O = any> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStream/readable) */
    readonly readable: ReadableStream<O>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStream/writable) */
    readonly writable: WritableStream<I>;
}

declare var TransformStream: {
    prototype: TransformStream;
    new<I = any, O = any>(transformer?: Transformer<I, O>, writableStrategy?: QueuingStrategy<I>, readableStrategy?: QueuingStrategy<O>): TransformStream<I, O>;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController) */
interface TransformStreamDefaultController<O = any> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController/desiredSize) */
    readonly desiredSize: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController/enqueue) */
    enqueue(chunk?: O): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController/error) */
    error(reason?: any): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/TransformStreamDefaultController/terminate) */
    terminate(): void;
}

declare var TransformStreamDefaultController: {
    prototype: TransformStreamDefaultController;
    new(): TransformStreamDefaultController;
};

/**
 * The URL interface represents an object providing static methods used for creating object URLs.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL)
 */
interface URL {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/hash) */
    hash: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/host) */
    host: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/hostname) */
    hostname: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/href) */
    href: string;
    toString(): string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/origin) */
    readonly origin: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/password) */
    password: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/pathname) */
    pathname: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/port) */
    port: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/protocol) */
    protocol: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/search) */
    search: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/searchParams) */
    readonly searchParams: URLSearchParams;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/username) */
    username: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/toJSON) */
    toJSON(): string;
}

declare var URL: {
    prototype: URL;
    new(url: string | URL, base?: string | URL): URL;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/canParse_static) */
    canParse(url: string | URL, base?: string | URL): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/createObjectURL_static) */
    createObjectURL(obj: Blob): string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/parse_static) */
    parse(url: string | URL, base?: string | URL): URL | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URL/revokeObjectURL_static) */
    revokeObjectURL(url: string): void;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams) */
interface URLSearchParams {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/size) */
    readonly size: number;
    /**
     * Appends a specified key/value pair as a new search parameter.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/append)
     */
    append(name: string, value: string): void;
    /**
     * Deletes the given search parameter, and its associated value, from the list of all search parameters.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/delete)
     */
    delete(name: string, value?: string): void;
    /**
     * Returns the first value associated to the given search parameter.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/get)
     */
    get(name: string): string | null;
    /**
     * Returns all the values association with a given search parameter.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/getAll)
     */
    getAll(name: string): string[];
    /**
     * Returns a Boolean indicating if such a search parameter exists.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/has)
     */
    has(name: string, value?: string): boolean;
    /**
     * Sets the value associated to a given search parameter to the given value. If there were several values, delete the others.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/set)
     */
    set(name: string, value: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/URLSearchParams/sort) */
    sort(): void;
    /** Returns a string containing a query string suitable for use in a URL. Does not include the question mark. */
    toString(): string;
    forEach(callbackfn: (value: string, key: string, parent: URLSearchParams) => void, thisArg?: any): void;
}

declare var URLSearchParams: {
    prototype: URLSearchParams;
    new(init?: string[][] | Record<string, string> | string | URLSearchParams): URLSearchParams;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoColorSpace) */
interface VideoColorSpace {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoColorSpace/fullRange) */
    readonly fullRange: boolean | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoColorSpace/matrix) */
    readonly matrix: VideoMatrixCoefficients | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoColorSpace/primaries) */
    readonly primaries: VideoColorPrimaries | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoColorSpace/transfer) */
    readonly transfer: VideoTransferCharacteristics | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoColorSpace/toJSON) */
    toJSON(): VideoColorSpaceInit;
}

declare var VideoColorSpace: {
    prototype: VideoColorSpace;
    new(init?: VideoColorSpaceInit): VideoColorSpace;
};

interface VideoDecoderEventMap {
    "dequeue": Event;
}

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder)
 */
interface VideoDecoder extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/decodeQueueSize) */
    readonly decodeQueueSize: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/dequeue_event) */
    ondequeue: ((this: VideoDecoder, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/state) */
    readonly state: CodecState;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/configure) */
    configure(config: VideoDecoderConfig): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/decode) */
    decode(chunk: EncodedVideoChunk): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/flush) */
    flush(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/reset) */
    reset(): void;
    addEventListener<K extends keyof VideoDecoderEventMap>(type: K, listener: (this: VideoDecoder, ev: VideoDecoderEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof VideoDecoderEventMap>(type: K, listener: (this: VideoDecoder, ev: VideoDecoderEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var VideoDecoder: {
    prototype: VideoDecoder;
    new(init: VideoDecoderInit): VideoDecoder;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoDecoder/isConfigSupported_static) */
    isConfigSupported(config: VideoDecoderConfig): Promise<VideoDecoderSupport>;
};

interface VideoEncoderEventMap {
    "dequeue": Event;
}

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder)
 */
interface VideoEncoder extends EventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/encodeQueueSize) */
    readonly encodeQueueSize: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/dequeue_event) */
    ondequeue: ((this: VideoEncoder, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/state) */
    readonly state: CodecState;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/configure) */
    configure(config: VideoEncoderConfig): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/encode) */
    encode(frame: VideoFrame, options?: VideoEncoderEncodeOptions): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/flush) */
    flush(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/reset) */
    reset(): void;
    addEventListener<K extends keyof VideoEncoderEventMap>(type: K, listener: (this: VideoEncoder, ev: VideoEncoderEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof VideoEncoderEventMap>(type: K, listener: (this: VideoEncoder, ev: VideoEncoderEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var VideoEncoder: {
    prototype: VideoEncoder;
    new(init: VideoEncoderInit): VideoEncoder;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoEncoder/isConfigSupported_static) */
    isConfigSupported(config: VideoEncoderConfig): Promise<VideoEncoderSupport>;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame) */
interface VideoFrame {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/codedHeight) */
    readonly codedHeight: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/codedRect) */
    readonly codedRect: DOMRectReadOnly | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/codedWidth) */
    readonly codedWidth: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/colorSpace) */
    readonly colorSpace: VideoColorSpace;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/displayHeight) */
    readonly displayHeight: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/displayWidth) */
    readonly displayWidth: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/duration) */
    readonly duration: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/format) */
    readonly format: VideoPixelFormat | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/timestamp) */
    readonly timestamp: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/visibleRect) */
    readonly visibleRect: DOMRectReadOnly | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/allocationSize) */
    allocationSize(options?: VideoFrameCopyToOptions): number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/clone) */
    clone(): VideoFrame;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/close) */
    close(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/VideoFrame/copyTo) */
    copyTo(destination: AllowSharedBufferSource, options?: VideoFrameCopyToOptions): Promise<PlaneLayout[]>;
}

declare var VideoFrame: {
    prototype: VideoFrame;
    new(image: CanvasImageSource, init?: VideoFrameInit): VideoFrame;
    new(data: AllowSharedBufferSource, init: VideoFrameBufferInit): VideoFrame;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_color_buffer_float) */
interface WEBGL_color_buffer_float {
    readonly RGBA32F_EXT: 0x8814;
    readonly FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE_EXT: 0x8211;
    readonly UNSIGNED_NORMALIZED_EXT: 0x8C17;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_compressed_texture_astc) */
interface WEBGL_compressed_texture_astc {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_compressed_texture_astc/getSupportedProfiles) */
    getSupportedProfiles(): string[];
    readonly COMPRESSED_RGBA_ASTC_4x4_KHR: 0x93B0;
    readonly COMPRESSED_RGBA_ASTC_5x4_KHR: 0x93B1;
    readonly COMPRESSED_RGBA_ASTC_5x5_KHR: 0x93B2;
    readonly COMPRESSED_RGBA_ASTC_6x5_KHR: 0x93B3;
    readonly COMPRESSED_RGBA_ASTC_6x6_KHR: 0x93B4;
    readonly COMPRESSED_RGBA_ASTC_8x5_KHR: 0x93B5;
    readonly COMPRESSED_RGBA_ASTC_8x6_KHR: 0x93B6;
    readonly COMPRESSED_RGBA_ASTC_8x8_KHR: 0x93B7;
    readonly COMPRESSED_RGBA_ASTC_10x5_KHR: 0x93B8;
    readonly COMPRESSED_RGBA_ASTC_10x6_KHR: 0x93B9;
    readonly COMPRESSED_RGBA_ASTC_10x8_KHR: 0x93BA;
    readonly COMPRESSED_RGBA_ASTC_10x10_KHR: 0x93BB;
    readonly COMPRESSED_RGBA_ASTC_12x10_KHR: 0x93BC;
    readonly COMPRESSED_RGBA_ASTC_12x12_KHR: 0x93BD;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_4x4_KHR: 0x93D0;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_5x4_KHR: 0x93D1;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_5x5_KHR: 0x93D2;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_6x5_KHR: 0x93D3;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_6x6_KHR: 0x93D4;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_8x5_KHR: 0x93D5;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_8x6_KHR: 0x93D6;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_8x8_KHR: 0x93D7;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_10x5_KHR: 0x93D8;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_10x6_KHR: 0x93D9;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_10x8_KHR: 0x93DA;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_10x10_KHR: 0x93DB;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_12x10_KHR: 0x93DC;
    readonly COMPRESSED_SRGB8_ALPHA8_ASTC_12x12_KHR: 0x93DD;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_compressed_texture_etc) */
interface WEBGL_compressed_texture_etc {
    readonly COMPRESSED_R11_EAC: 0x9270;
    readonly COMPRESSED_SIGNED_R11_EAC: 0x9271;
    readonly COMPRESSED_RG11_EAC: 0x9272;
    readonly COMPRESSED_SIGNED_RG11_EAC: 0x9273;
    readonly COMPRESSED_RGB8_ETC2: 0x9274;
    readonly COMPRESSED_SRGB8_ETC2: 0x9275;
    readonly COMPRESSED_RGB8_PUNCHTHROUGH_ALPHA1_ETC2: 0x9276;
    readonly COMPRESSED_SRGB8_PUNCHTHROUGH_ALPHA1_ETC2: 0x9277;
    readonly COMPRESSED_RGBA8_ETC2_EAC: 0x9278;
    readonly COMPRESSED_SRGB8_ALPHA8_ETC2_EAC: 0x9279;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_compressed_texture_etc1) */
interface WEBGL_compressed_texture_etc1 {
    readonly COMPRESSED_RGB_ETC1_WEBGL: 0x8D64;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_compressed_texture_pvrtc) */
interface WEBGL_compressed_texture_pvrtc {
    readonly COMPRESSED_RGB_PVRTC_4BPPV1_IMG: 0x8C00;
    readonly COMPRESSED_RGB_PVRTC_2BPPV1_IMG: 0x8C01;
    readonly COMPRESSED_RGBA_PVRTC_4BPPV1_IMG: 0x8C02;
    readonly COMPRESSED_RGBA_PVRTC_2BPPV1_IMG: 0x8C03;
}

/**
 * The WEBGL_compressed_texture_s3tc extension is part of the WebGL API and exposes four S3TC compressed texture formats.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_compressed_texture_s3tc)
 */
interface WEBGL_compressed_texture_s3tc {
    readonly COMPRESSED_RGB_S3TC_DXT1_EXT: 0x83F0;
    readonly COMPRESSED_RGBA_S3TC_DXT1_EXT: 0x83F1;
    readonly COMPRESSED_RGBA_S3TC_DXT3_EXT: 0x83F2;
    readonly COMPRESSED_RGBA_S3TC_DXT5_EXT: 0x83F3;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_compressed_texture_s3tc_srgb) */
interface WEBGL_compressed_texture_s3tc_srgb {
    readonly COMPRESSED_SRGB_S3TC_DXT1_EXT: 0x8C4C;
    readonly COMPRESSED_SRGB_ALPHA_S3TC_DXT1_EXT: 0x8C4D;
    readonly COMPRESSED_SRGB_ALPHA_S3TC_DXT3_EXT: 0x8C4E;
    readonly COMPRESSED_SRGB_ALPHA_S3TC_DXT5_EXT: 0x8C4F;
}

/**
 * The WEBGL_debug_renderer_info extension is part of the WebGL API and exposes two constants with information about the graphics driver for debugging purposes.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_debug_renderer_info)
 */
interface WEBGL_debug_renderer_info {
    readonly UNMASKED_VENDOR_WEBGL: 0x9245;
    readonly UNMASKED_RENDERER_WEBGL: 0x9246;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_debug_shaders) */
interface WEBGL_debug_shaders {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_debug_shaders/getTranslatedShaderSource) */
    getTranslatedShaderSource(shader: WebGLShader): string;
}

/**
 * The WEBGL_depth_texture extension is part of the WebGL API and defines 2D depth and depth-stencil textures.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_depth_texture)
 */
interface WEBGL_depth_texture {
    readonly UNSIGNED_INT_24_8_WEBGL: 0x84FA;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_draw_buffers) */
interface WEBGL_draw_buffers {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_draw_buffers/drawBuffersWEBGL) */
    drawBuffersWEBGL(buffers: GLenum[]): void;
    readonly COLOR_ATTACHMENT0_WEBGL: 0x8CE0;
    readonly COLOR_ATTACHMENT1_WEBGL: 0x8CE1;
    readonly COLOR_ATTACHMENT2_WEBGL: 0x8CE2;
    readonly COLOR_ATTACHMENT3_WEBGL: 0x8CE3;
    readonly COLOR_ATTACHMENT4_WEBGL: 0x8CE4;
    readonly COLOR_ATTACHMENT5_WEBGL: 0x8CE5;
    readonly COLOR_ATTACHMENT6_WEBGL: 0x8CE6;
    readonly COLOR_ATTACHMENT7_WEBGL: 0x8CE7;
    readonly COLOR_ATTACHMENT8_WEBGL: 0x8CE8;
    readonly COLOR_ATTACHMENT9_WEBGL: 0x8CE9;
    readonly COLOR_ATTACHMENT10_WEBGL: 0x8CEA;
    readonly COLOR_ATTACHMENT11_WEBGL: 0x8CEB;
    readonly COLOR_ATTACHMENT12_WEBGL: 0x8CEC;
    readonly COLOR_ATTACHMENT13_WEBGL: 0x8CED;
    readonly COLOR_ATTACHMENT14_WEBGL: 0x8CEE;
    readonly COLOR_ATTACHMENT15_WEBGL: 0x8CEF;
    readonly DRAW_BUFFER0_WEBGL: 0x8825;
    readonly DRAW_BUFFER1_WEBGL: 0x8826;
    readonly DRAW_BUFFER2_WEBGL: 0x8827;
    readonly DRAW_BUFFER3_WEBGL: 0x8828;
    readonly DRAW_BUFFER4_WEBGL: 0x8829;
    readonly DRAW_BUFFER5_WEBGL: 0x882A;
    readonly DRAW_BUFFER6_WEBGL: 0x882B;
    readonly DRAW_BUFFER7_WEBGL: 0x882C;
    readonly DRAW_BUFFER8_WEBGL: 0x882D;
    readonly DRAW_BUFFER9_WEBGL: 0x882E;
    readonly DRAW_BUFFER10_WEBGL: 0x882F;
    readonly DRAW_BUFFER11_WEBGL: 0x8830;
    readonly DRAW_BUFFER12_WEBGL: 0x8831;
    readonly DRAW_BUFFER13_WEBGL: 0x8832;
    readonly DRAW_BUFFER14_WEBGL: 0x8833;
    readonly DRAW_BUFFER15_WEBGL: 0x8834;
    readonly MAX_COLOR_ATTACHMENTS_WEBGL: 0x8CDF;
    readonly MAX_DRAW_BUFFERS_WEBGL: 0x8824;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_lose_context) */
interface WEBGL_lose_context {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_lose_context/loseContext) */
    loseContext(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_lose_context/restoreContext) */
    restoreContext(): void;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_multi_draw) */
interface WEBGL_multi_draw {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_multi_draw/multiDrawArraysInstancedWEBGL) */
    multiDrawArraysInstancedWEBGL(mode: GLenum, firstsList: Int32Array | GLint[], firstsOffset: number, countsList: Int32Array | GLsizei[], countsOffset: number, instanceCountsList: Int32Array | GLsizei[], instanceCountsOffset: number, drawcount: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_multi_draw/multiDrawArraysWEBGL) */
    multiDrawArraysWEBGL(mode: GLenum, firstsList: Int32Array | GLint[], firstsOffset: number, countsList: Int32Array | GLsizei[], countsOffset: number, drawcount: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_multi_draw/multiDrawElementsInstancedWEBGL) */
    multiDrawElementsInstancedWEBGL(mode: GLenum, countsList: Int32Array | GLsizei[], countsOffset: number, type: GLenum, offsetsList: Int32Array | GLsizei[], offsetsOffset: number, instanceCountsList: Int32Array | GLsizei[], instanceCountsOffset: number, drawcount: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WEBGL_multi_draw/multiDrawElementsWEBGL) */
    multiDrawElementsWEBGL(mode: GLenum, countsList: Int32Array | GLsizei[], countsOffset: number, type: GLenum, offsetsList: Int32Array | GLsizei[], offsetsOffset: number, drawcount: GLsizei): void;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext) */
interface WebGL2RenderingContext extends WebGL2RenderingContextBase, WebGL2RenderingContextOverloads, WebGLRenderingContextBase {
}

declare var WebGL2RenderingContext: {
    prototype: WebGL2RenderingContext;
    new(): WebGL2RenderingContext;
    readonly READ_BUFFER: 0x0C02;
    readonly UNPACK_ROW_LENGTH: 0x0CF2;
    readonly UNPACK_SKIP_ROWS: 0x0CF3;
    readonly UNPACK_SKIP_PIXELS: 0x0CF4;
    readonly PACK_ROW_LENGTH: 0x0D02;
    readonly PACK_SKIP_ROWS: 0x0D03;
    readonly PACK_SKIP_PIXELS: 0x0D04;
    readonly COLOR: 0x1800;
    readonly DEPTH: 0x1801;
    readonly STENCIL: 0x1802;
    readonly RED: 0x1903;
    readonly RGB8: 0x8051;
    readonly RGB10_A2: 0x8059;
    readonly TEXTURE_BINDING_3D: 0x806A;
    readonly UNPACK_SKIP_IMAGES: 0x806D;
    readonly UNPACK_IMAGE_HEIGHT: 0x806E;
    readonly TEXTURE_3D: 0x806F;
    readonly TEXTURE_WRAP_R: 0x8072;
    readonly MAX_3D_TEXTURE_SIZE: 0x8073;
    readonly UNSIGNED_INT_2_10_10_10_REV: 0x8368;
    readonly MAX_ELEMENTS_VERTICES: 0x80E8;
    readonly MAX_ELEMENTS_INDICES: 0x80E9;
    readonly TEXTURE_MIN_LOD: 0x813A;
    readonly TEXTURE_MAX_LOD: 0x813B;
    readonly TEXTURE_BASE_LEVEL: 0x813C;
    readonly TEXTURE_MAX_LEVEL: 0x813D;
    readonly MIN: 0x8007;
    readonly MAX: 0x8008;
    readonly DEPTH_COMPONENT24: 0x81A6;
    readonly MAX_TEXTURE_LOD_BIAS: 0x84FD;
    readonly TEXTURE_COMPARE_MODE: 0x884C;
    readonly TEXTURE_COMPARE_FUNC: 0x884D;
    readonly CURRENT_QUERY: 0x8865;
    readonly QUERY_RESULT: 0x8866;
    readonly QUERY_RESULT_AVAILABLE: 0x8867;
    readonly STREAM_READ: 0x88E1;
    readonly STREAM_COPY: 0x88E2;
    readonly STATIC_READ: 0x88E5;
    readonly STATIC_COPY: 0x88E6;
    readonly DYNAMIC_READ: 0x88E9;
    readonly DYNAMIC_COPY: 0x88EA;
    readonly MAX_DRAW_BUFFERS: 0x8824;
    readonly DRAW_BUFFER0: 0x8825;
    readonly DRAW_BUFFER1: 0x8826;
    readonly DRAW_BUFFER2: 0x8827;
    readonly DRAW_BUFFER3: 0x8828;
    readonly DRAW_BUFFER4: 0x8829;
    readonly DRAW_BUFFER5: 0x882A;
    readonly DRAW_BUFFER6: 0x882B;
    readonly DRAW_BUFFER7: 0x882C;
    readonly DRAW_BUFFER8: 0x882D;
    readonly DRAW_BUFFER9: 0x882E;
    readonly DRAW_BUFFER10: 0x882F;
    readonly DRAW_BUFFER11: 0x8830;
    readonly DRAW_BUFFER12: 0x8831;
    readonly DRAW_BUFFER13: 0x8832;
    readonly DRAW_BUFFER14: 0x8833;
    readonly DRAW_BUFFER15: 0x8834;
    readonly MAX_FRAGMENT_UNIFORM_COMPONENTS: 0x8B49;
    readonly MAX_VERTEX_UNIFORM_COMPONENTS: 0x8B4A;
    readonly SAMPLER_3D: 0x8B5F;
    readonly SAMPLER_2D_SHADOW: 0x8B62;
    readonly FRAGMENT_SHADER_DERIVATIVE_HINT: 0x8B8B;
    readonly PIXEL_PACK_BUFFER: 0x88EB;
    readonly PIXEL_UNPACK_BUFFER: 0x88EC;
    readonly PIXEL_PACK_BUFFER_BINDING: 0x88ED;
    readonly PIXEL_UNPACK_BUFFER_BINDING: 0x88EF;
    readonly FLOAT_MAT2x3: 0x8B65;
    readonly FLOAT_MAT2x4: 0x8B66;
    readonly FLOAT_MAT3x2: 0x8B67;
    readonly FLOAT_MAT3x4: 0x8B68;
    readonly FLOAT_MAT4x2: 0x8B69;
    readonly FLOAT_MAT4x3: 0x8B6A;
    readonly SRGB: 0x8C40;
    readonly SRGB8: 0x8C41;
    readonly SRGB8_ALPHA8: 0x8C43;
    readonly COMPARE_REF_TO_TEXTURE: 0x884E;
    readonly RGBA32F: 0x8814;
    readonly RGB32F: 0x8815;
    readonly RGBA16F: 0x881A;
    readonly RGB16F: 0x881B;
    readonly VERTEX_ATTRIB_ARRAY_INTEGER: 0x88FD;
    readonly MAX_ARRAY_TEXTURE_LAYERS: 0x88FF;
    readonly MIN_PROGRAM_TEXEL_OFFSET: 0x8904;
    readonly MAX_PROGRAM_TEXEL_OFFSET: 0x8905;
    readonly MAX_VARYING_COMPONENTS: 0x8B4B;
    readonly TEXTURE_2D_ARRAY: 0x8C1A;
    readonly TEXTURE_BINDING_2D_ARRAY: 0x8C1D;
    readonly R11F_G11F_B10F: 0x8C3A;
    readonly UNSIGNED_INT_10F_11F_11F_REV: 0x8C3B;
    readonly RGB9_E5: 0x8C3D;
    readonly UNSIGNED_INT_5_9_9_9_REV: 0x8C3E;
    readonly TRANSFORM_FEEDBACK_BUFFER_MODE: 0x8C7F;
    readonly MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS: 0x8C80;
    readonly TRANSFORM_FEEDBACK_VARYINGS: 0x8C83;
    readonly TRANSFORM_FEEDBACK_BUFFER_START: 0x8C84;
    readonly TRANSFORM_FEEDBACK_BUFFER_SIZE: 0x8C85;
    readonly TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN: 0x8C88;
    readonly RASTERIZER_DISCARD: 0x8C89;
    readonly MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: 0x8C8A;
    readonly MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: 0x8C8B;
    readonly INTERLEAVED_ATTRIBS: 0x8C8C;
    readonly SEPARATE_ATTRIBS: 0x8C8D;
    readonly TRANSFORM_FEEDBACK_BUFFER: 0x8C8E;
    readonly TRANSFORM_FEEDBACK_BUFFER_BINDING: 0x8C8F;
    readonly RGBA32UI: 0x8D70;
    readonly RGB32UI: 0x8D71;
    readonly RGBA16UI: 0x8D76;
    readonly RGB16UI: 0x8D77;
    readonly RGBA8UI: 0x8D7C;
    readonly RGB8UI: 0x8D7D;
    readonly RGBA32I: 0x8D82;
    readonly RGB32I: 0x8D83;
    readonly RGBA16I: 0x8D88;
    readonly RGB16I: 0x8D89;
    readonly RGBA8I: 0x8D8E;
    readonly RGB8I: 0x8D8F;
    readonly RED_INTEGER: 0x8D94;
    readonly RGB_INTEGER: 0x8D98;
    readonly RGBA_INTEGER: 0x8D99;
    readonly SAMPLER_2D_ARRAY: 0x8DC1;
    readonly SAMPLER_2D_ARRAY_SHADOW: 0x8DC4;
    readonly SAMPLER_CUBE_SHADOW: 0x8DC5;
    readonly UNSIGNED_INT_VEC2: 0x8DC6;
    readonly UNSIGNED_INT_VEC3: 0x8DC7;
    readonly UNSIGNED_INT_VEC4: 0x8DC8;
    readonly INT_SAMPLER_2D: 0x8DCA;
    readonly INT_SAMPLER_3D: 0x8DCB;
    readonly INT_SAMPLER_CUBE: 0x8DCC;
    readonly INT_SAMPLER_2D_ARRAY: 0x8DCF;
    readonly UNSIGNED_INT_SAMPLER_2D: 0x8DD2;
    readonly UNSIGNED_INT_SAMPLER_3D: 0x8DD3;
    readonly UNSIGNED_INT_SAMPLER_CUBE: 0x8DD4;
    readonly UNSIGNED_INT_SAMPLER_2D_ARRAY: 0x8DD7;
    readonly DEPTH_COMPONENT32F: 0x8CAC;
    readonly DEPTH32F_STENCIL8: 0x8CAD;
    readonly FLOAT_32_UNSIGNED_INT_24_8_REV: 0x8DAD;
    readonly FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING: 0x8210;
    readonly FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE: 0x8211;
    readonly FRAMEBUFFER_ATTACHMENT_RED_SIZE: 0x8212;
    readonly FRAMEBUFFER_ATTACHMENT_GREEN_SIZE: 0x8213;
    readonly FRAMEBUFFER_ATTACHMENT_BLUE_SIZE: 0x8214;
    readonly FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE: 0x8215;
    readonly FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE: 0x8216;
    readonly FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE: 0x8217;
    readonly FRAMEBUFFER_DEFAULT: 0x8218;
    readonly UNSIGNED_INT_24_8: 0x84FA;
    readonly DEPTH24_STENCIL8: 0x88F0;
    readonly UNSIGNED_NORMALIZED: 0x8C17;
    readonly DRAW_FRAMEBUFFER_BINDING: 0x8CA6;
    readonly READ_FRAMEBUFFER: 0x8CA8;
    readonly DRAW_FRAMEBUFFER: 0x8CA9;
    readonly READ_FRAMEBUFFER_BINDING: 0x8CAA;
    readonly RENDERBUFFER_SAMPLES: 0x8CAB;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER: 0x8CD4;
    readonly MAX_COLOR_ATTACHMENTS: 0x8CDF;
    readonly COLOR_ATTACHMENT1: 0x8CE1;
    readonly COLOR_ATTACHMENT2: 0x8CE2;
    readonly COLOR_ATTACHMENT3: 0x8CE3;
    readonly COLOR_ATTACHMENT4: 0x8CE4;
    readonly COLOR_ATTACHMENT5: 0x8CE5;
    readonly COLOR_ATTACHMENT6: 0x8CE6;
    readonly COLOR_ATTACHMENT7: 0x8CE7;
    readonly COLOR_ATTACHMENT8: 0x8CE8;
    readonly COLOR_ATTACHMENT9: 0x8CE9;
    readonly COLOR_ATTACHMENT10: 0x8CEA;
    readonly COLOR_ATTACHMENT11: 0x8CEB;
    readonly COLOR_ATTACHMENT12: 0x8CEC;
    readonly COLOR_ATTACHMENT13: 0x8CED;
    readonly COLOR_ATTACHMENT14: 0x8CEE;
    readonly COLOR_ATTACHMENT15: 0x8CEF;
    readonly FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: 0x8D56;
    readonly MAX_SAMPLES: 0x8D57;
    readonly HALF_FLOAT: 0x140B;
    readonly RG: 0x8227;
    readonly RG_INTEGER: 0x8228;
    readonly R8: 0x8229;
    readonly RG8: 0x822B;
    readonly R16F: 0x822D;
    readonly R32F: 0x822E;
    readonly RG16F: 0x822F;
    readonly RG32F: 0x8230;
    readonly R8I: 0x8231;
    readonly R8UI: 0x8232;
    readonly R16I: 0x8233;
    readonly R16UI: 0x8234;
    readonly R32I: 0x8235;
    readonly R32UI: 0x8236;
    readonly RG8I: 0x8237;
    readonly RG8UI: 0x8238;
    readonly RG16I: 0x8239;
    readonly RG16UI: 0x823A;
    readonly RG32I: 0x823B;
    readonly RG32UI: 0x823C;
    readonly VERTEX_ARRAY_BINDING: 0x85B5;
    readonly R8_SNORM: 0x8F94;
    readonly RG8_SNORM: 0x8F95;
    readonly RGB8_SNORM: 0x8F96;
    readonly RGBA8_SNORM: 0x8F97;
    readonly SIGNED_NORMALIZED: 0x8F9C;
    readonly COPY_READ_BUFFER: 0x8F36;
    readonly COPY_WRITE_BUFFER: 0x8F37;
    readonly COPY_READ_BUFFER_BINDING: 0x8F36;
    readonly COPY_WRITE_BUFFER_BINDING: 0x8F37;
    readonly UNIFORM_BUFFER: 0x8A11;
    readonly UNIFORM_BUFFER_BINDING: 0x8A28;
    readonly UNIFORM_BUFFER_START: 0x8A29;
    readonly UNIFORM_BUFFER_SIZE: 0x8A2A;
    readonly MAX_VERTEX_UNIFORM_BLOCKS: 0x8A2B;
    readonly MAX_FRAGMENT_UNIFORM_BLOCKS: 0x8A2D;
    readonly MAX_COMBINED_UNIFORM_BLOCKS: 0x8A2E;
    readonly MAX_UNIFORM_BUFFER_BINDINGS: 0x8A2F;
    readonly MAX_UNIFORM_BLOCK_SIZE: 0x8A30;
    readonly MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS: 0x8A31;
    readonly MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS: 0x8A33;
    readonly UNIFORM_BUFFER_OFFSET_ALIGNMENT: 0x8A34;
    readonly ACTIVE_UNIFORM_BLOCKS: 0x8A36;
    readonly UNIFORM_TYPE: 0x8A37;
    readonly UNIFORM_SIZE: 0x8A38;
    readonly UNIFORM_BLOCK_INDEX: 0x8A3A;
    readonly UNIFORM_OFFSET: 0x8A3B;
    readonly UNIFORM_ARRAY_STRIDE: 0x8A3C;
    readonly UNIFORM_MATRIX_STRIDE: 0x8A3D;
    readonly UNIFORM_IS_ROW_MAJOR: 0x8A3E;
    readonly UNIFORM_BLOCK_BINDING: 0x8A3F;
    readonly UNIFORM_BLOCK_DATA_SIZE: 0x8A40;
    readonly UNIFORM_BLOCK_ACTIVE_UNIFORMS: 0x8A42;
    readonly UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES: 0x8A43;
    readonly UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER: 0x8A44;
    readonly UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER: 0x8A46;
    readonly INVALID_INDEX: 0xFFFFFFFF;
    readonly MAX_VERTEX_OUTPUT_COMPONENTS: 0x9122;
    readonly MAX_FRAGMENT_INPUT_COMPONENTS: 0x9125;
    readonly MAX_SERVER_WAIT_TIMEOUT: 0x9111;
    readonly OBJECT_TYPE: 0x9112;
    readonly SYNC_CONDITION: 0x9113;
    readonly SYNC_STATUS: 0x9114;
    readonly SYNC_FLAGS: 0x9115;
    readonly SYNC_FENCE: 0x9116;
    readonly SYNC_GPU_COMMANDS_COMPLETE: 0x9117;
    readonly UNSIGNALED: 0x9118;
    readonly SIGNALED: 0x9119;
    readonly ALREADY_SIGNALED: 0x911A;
    readonly TIMEOUT_EXPIRED: 0x911B;
    readonly CONDITION_SATISFIED: 0x911C;
    readonly WAIT_FAILED: 0x911D;
    readonly SYNC_FLUSH_COMMANDS_BIT: 0x00000001;
    readonly VERTEX_ATTRIB_ARRAY_DIVISOR: 0x88FE;
    readonly ANY_SAMPLES_PASSED: 0x8C2F;
    readonly ANY_SAMPLES_PASSED_CONSERVATIVE: 0x8D6A;
    readonly SAMPLER_BINDING: 0x8919;
    readonly RGB10_A2UI: 0x906F;
    readonly INT_2_10_10_10_REV: 0x8D9F;
    readonly TRANSFORM_FEEDBACK: 0x8E22;
    readonly TRANSFORM_FEEDBACK_PAUSED: 0x8E23;
    readonly TRANSFORM_FEEDBACK_ACTIVE: 0x8E24;
    readonly TRANSFORM_FEEDBACK_BINDING: 0x8E25;
    readonly TEXTURE_IMMUTABLE_FORMAT: 0x912F;
    readonly MAX_ELEMENT_INDEX: 0x8D6B;
    readonly TEXTURE_IMMUTABLE_LEVELS: 0x82DF;
    readonly TIMEOUT_IGNORED: -1;
    readonly MAX_CLIENT_WAIT_TIMEOUT_WEBGL: 0x9247;
    readonly DEPTH_BUFFER_BIT: 0x00000100;
    readonly STENCIL_BUFFER_BIT: 0x00000400;
    readonly COLOR_BUFFER_BIT: 0x00004000;
    readonly POINTS: 0x0000;
    readonly LINES: 0x0001;
    readonly LINE_LOOP: 0x0002;
    readonly LINE_STRIP: 0x0003;
    readonly TRIANGLES: 0x0004;
    readonly TRIANGLE_STRIP: 0x0005;
    readonly TRIANGLE_FAN: 0x0006;
    readonly ZERO: 0;
    readonly ONE: 1;
    readonly SRC_COLOR: 0x0300;
    readonly ONE_MINUS_SRC_COLOR: 0x0301;
    readonly SRC_ALPHA: 0x0302;
    readonly ONE_MINUS_SRC_ALPHA: 0x0303;
    readonly DST_ALPHA: 0x0304;
    readonly ONE_MINUS_DST_ALPHA: 0x0305;
    readonly DST_COLOR: 0x0306;
    readonly ONE_MINUS_DST_COLOR: 0x0307;
    readonly SRC_ALPHA_SATURATE: 0x0308;
    readonly FUNC_ADD: 0x8006;
    readonly BLEND_EQUATION: 0x8009;
    readonly BLEND_EQUATION_RGB: 0x8009;
    readonly BLEND_EQUATION_ALPHA: 0x883D;
    readonly FUNC_SUBTRACT: 0x800A;
    readonly FUNC_REVERSE_SUBTRACT: 0x800B;
    readonly BLEND_DST_RGB: 0x80C8;
    readonly BLEND_SRC_RGB: 0x80C9;
    readonly BLEND_DST_ALPHA: 0x80CA;
    readonly BLEND_SRC_ALPHA: 0x80CB;
    readonly CONSTANT_COLOR: 0x8001;
    readonly ONE_MINUS_CONSTANT_COLOR: 0x8002;
    readonly CONSTANT_ALPHA: 0x8003;
    readonly ONE_MINUS_CONSTANT_ALPHA: 0x8004;
    readonly BLEND_COLOR: 0x8005;
    readonly ARRAY_BUFFER: 0x8892;
    readonly ELEMENT_ARRAY_BUFFER: 0x8893;
    readonly ARRAY_BUFFER_BINDING: 0x8894;
    readonly ELEMENT_ARRAY_BUFFER_BINDING: 0x8895;
    readonly STREAM_DRAW: 0x88E0;
    readonly STATIC_DRAW: 0x88E4;
    readonly DYNAMIC_DRAW: 0x88E8;
    readonly BUFFER_SIZE: 0x8764;
    readonly BUFFER_USAGE: 0x8765;
    readonly CURRENT_VERTEX_ATTRIB: 0x8626;
    readonly FRONT: 0x0404;
    readonly BACK: 0x0405;
    readonly FRONT_AND_BACK: 0x0408;
    readonly CULL_FACE: 0x0B44;
    readonly BLEND: 0x0BE2;
    readonly DITHER: 0x0BD0;
    readonly STENCIL_TEST: 0x0B90;
    readonly DEPTH_TEST: 0x0B71;
    readonly SCISSOR_TEST: 0x0C11;
    readonly POLYGON_OFFSET_FILL: 0x8037;
    readonly SAMPLE_ALPHA_TO_COVERAGE: 0x809E;
    readonly SAMPLE_COVERAGE: 0x80A0;
    readonly NO_ERROR: 0;
    readonly INVALID_ENUM: 0x0500;
    readonly INVALID_VALUE: 0x0501;
    readonly INVALID_OPERATION: 0x0502;
    readonly OUT_OF_MEMORY: 0x0505;
    readonly CW: 0x0900;
    readonly CCW: 0x0901;
    readonly LINE_WIDTH: 0x0B21;
    readonly ALIASED_POINT_SIZE_RANGE: 0x846D;
    readonly ALIASED_LINE_WIDTH_RANGE: 0x846E;
    readonly CULL_FACE_MODE: 0x0B45;
    readonly FRONT_FACE: 0x0B46;
    readonly DEPTH_RANGE: 0x0B70;
    readonly DEPTH_WRITEMASK: 0x0B72;
    readonly DEPTH_CLEAR_VALUE: 0x0B73;
    readonly DEPTH_FUNC: 0x0B74;
    readonly STENCIL_CLEAR_VALUE: 0x0B91;
    readonly STENCIL_FUNC: 0x0B92;
    readonly STENCIL_FAIL: 0x0B94;
    readonly STENCIL_PASS_DEPTH_FAIL: 0x0B95;
    readonly STENCIL_PASS_DEPTH_PASS: 0x0B96;
    readonly STENCIL_REF: 0x0B97;
    readonly STENCIL_VALUE_MASK: 0x0B93;
    readonly STENCIL_WRITEMASK: 0x0B98;
    readonly STENCIL_BACK_FUNC: 0x8800;
    readonly STENCIL_BACK_FAIL: 0x8801;
    readonly STENCIL_BACK_PASS_DEPTH_FAIL: 0x8802;
    readonly STENCIL_BACK_PASS_DEPTH_PASS: 0x8803;
    readonly STENCIL_BACK_REF: 0x8CA3;
    readonly STENCIL_BACK_VALUE_MASK: 0x8CA4;
    readonly STENCIL_BACK_WRITEMASK: 0x8CA5;
    readonly VIEWPORT: 0x0BA2;
    readonly SCISSOR_BOX: 0x0C10;
    readonly COLOR_CLEAR_VALUE: 0x0C22;
    readonly COLOR_WRITEMASK: 0x0C23;
    readonly UNPACK_ALIGNMENT: 0x0CF5;
    readonly PACK_ALIGNMENT: 0x0D05;
    readonly MAX_TEXTURE_SIZE: 0x0D33;
    readonly MAX_VIEWPORT_DIMS: 0x0D3A;
    readonly SUBPIXEL_BITS: 0x0D50;
    readonly RED_BITS: 0x0D52;
    readonly GREEN_BITS: 0x0D53;
    readonly BLUE_BITS: 0x0D54;
    readonly ALPHA_BITS: 0x0D55;
    readonly DEPTH_BITS: 0x0D56;
    readonly STENCIL_BITS: 0x0D57;
    readonly POLYGON_OFFSET_UNITS: 0x2A00;
    readonly POLYGON_OFFSET_FACTOR: 0x8038;
    readonly TEXTURE_BINDING_2D: 0x8069;
    readonly SAMPLE_BUFFERS: 0x80A8;
    readonly SAMPLES: 0x80A9;
    readonly SAMPLE_COVERAGE_VALUE: 0x80AA;
    readonly SAMPLE_COVERAGE_INVERT: 0x80AB;
    readonly COMPRESSED_TEXTURE_FORMATS: 0x86A3;
    readonly DONT_CARE: 0x1100;
    readonly FASTEST: 0x1101;
    readonly NICEST: 0x1102;
    readonly GENERATE_MIPMAP_HINT: 0x8192;
    readonly BYTE: 0x1400;
    readonly UNSIGNED_BYTE: 0x1401;
    readonly SHORT: 0x1402;
    readonly UNSIGNED_SHORT: 0x1403;
    readonly INT: 0x1404;
    readonly UNSIGNED_INT: 0x1405;
    readonly FLOAT: 0x1406;
    readonly DEPTH_COMPONENT: 0x1902;
    readonly ALPHA: 0x1906;
    readonly RGB: 0x1907;
    readonly RGBA: 0x1908;
    readonly LUMINANCE: 0x1909;
    readonly LUMINANCE_ALPHA: 0x190A;
    readonly UNSIGNED_SHORT_4_4_4_4: 0x8033;
    readonly UNSIGNED_SHORT_5_5_5_1: 0x8034;
    readonly UNSIGNED_SHORT_5_6_5: 0x8363;
    readonly FRAGMENT_SHADER: 0x8B30;
    readonly VERTEX_SHADER: 0x8B31;
    readonly MAX_VERTEX_ATTRIBS: 0x8869;
    readonly MAX_VERTEX_UNIFORM_VECTORS: 0x8DFB;
    readonly MAX_VARYING_VECTORS: 0x8DFC;
    readonly MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8B4D;
    readonly MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8B4C;
    readonly MAX_TEXTURE_IMAGE_UNITS: 0x8872;
    readonly MAX_FRAGMENT_UNIFORM_VECTORS: 0x8DFD;
    readonly SHADER_TYPE: 0x8B4F;
    readonly DELETE_STATUS: 0x8B80;
    readonly LINK_STATUS: 0x8B82;
    readonly VALIDATE_STATUS: 0x8B83;
    readonly ATTACHED_SHADERS: 0x8B85;
    readonly ACTIVE_UNIFORMS: 0x8B86;
    readonly ACTIVE_ATTRIBUTES: 0x8B89;
    readonly SHADING_LANGUAGE_VERSION: 0x8B8C;
    readonly CURRENT_PROGRAM: 0x8B8D;
    readonly NEVER: 0x0200;
    readonly LESS: 0x0201;
    readonly EQUAL: 0x0202;
    readonly LEQUAL: 0x0203;
    readonly GREATER: 0x0204;
    readonly NOTEQUAL: 0x0205;
    readonly GEQUAL: 0x0206;
    readonly ALWAYS: 0x0207;
    readonly KEEP: 0x1E00;
    readonly REPLACE: 0x1E01;
    readonly INCR: 0x1E02;
    readonly DECR: 0x1E03;
    readonly INVERT: 0x150A;
    readonly INCR_WRAP: 0x8507;
    readonly DECR_WRAP: 0x8508;
    readonly VENDOR: 0x1F00;
    readonly RENDERER: 0x1F01;
    readonly VERSION: 0x1F02;
    readonly NEAREST: 0x2600;
    readonly LINEAR: 0x2601;
    readonly NEAREST_MIPMAP_NEAREST: 0x2700;
    readonly LINEAR_MIPMAP_NEAREST: 0x2701;
    readonly NEAREST_MIPMAP_LINEAR: 0x2702;
    readonly LINEAR_MIPMAP_LINEAR: 0x2703;
    readonly TEXTURE_MAG_FILTER: 0x2800;
    readonly TEXTURE_MIN_FILTER: 0x2801;
    readonly TEXTURE_WRAP_S: 0x2802;
    readonly TEXTURE_WRAP_T: 0x2803;
    readonly TEXTURE_2D: 0x0DE1;
    readonly TEXTURE: 0x1702;
    readonly TEXTURE_CUBE_MAP: 0x8513;
    readonly TEXTURE_BINDING_CUBE_MAP: 0x8514;
    readonly TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_X: 0x8516;
    readonly TEXTURE_CUBE_MAP_POSITIVE_Y: 0x8517;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_Y: 0x8518;
    readonly TEXTURE_CUBE_MAP_POSITIVE_Z: 0x8519;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_Z: 0x851A;
    readonly MAX_CUBE_MAP_TEXTURE_SIZE: 0x851C;
    readonly TEXTURE0: 0x84C0;
    readonly TEXTURE1: 0x84C1;
    readonly TEXTURE2: 0x84C2;
    readonly TEXTURE3: 0x84C3;
    readonly TEXTURE4: 0x84C4;
    readonly TEXTURE5: 0x84C5;
    readonly TEXTURE6: 0x84C6;
    readonly TEXTURE7: 0x84C7;
    readonly TEXTURE8: 0x84C8;
    readonly TEXTURE9: 0x84C9;
    readonly TEXTURE10: 0x84CA;
    readonly TEXTURE11: 0x84CB;
    readonly TEXTURE12: 0x84CC;
    readonly TEXTURE13: 0x84CD;
    readonly TEXTURE14: 0x84CE;
    readonly TEXTURE15: 0x84CF;
    readonly TEXTURE16: 0x84D0;
    readonly TEXTURE17: 0x84D1;
    readonly TEXTURE18: 0x84D2;
    readonly TEXTURE19: 0x84D3;
    readonly TEXTURE20: 0x84D4;
    readonly TEXTURE21: 0x84D5;
    readonly TEXTURE22: 0x84D6;
    readonly TEXTURE23: 0x84D7;
    readonly TEXTURE24: 0x84D8;
    readonly TEXTURE25: 0x84D9;
    readonly TEXTURE26: 0x84DA;
    readonly TEXTURE27: 0x84DB;
    readonly TEXTURE28: 0x84DC;
    readonly TEXTURE29: 0x84DD;
    readonly TEXTURE30: 0x84DE;
    readonly TEXTURE31: 0x84DF;
    readonly ACTIVE_TEXTURE: 0x84E0;
    readonly REPEAT: 0x2901;
    readonly CLAMP_TO_EDGE: 0x812F;
    readonly MIRRORED_REPEAT: 0x8370;
    readonly FLOAT_VEC2: 0x8B50;
    readonly FLOAT_VEC3: 0x8B51;
    readonly FLOAT_VEC4: 0x8B52;
    readonly INT_VEC2: 0x8B53;
    readonly INT_VEC3: 0x8B54;
    readonly INT_VEC4: 0x8B55;
    readonly BOOL: 0x8B56;
    readonly BOOL_VEC2: 0x8B57;
    readonly BOOL_VEC3: 0x8B58;
    readonly BOOL_VEC4: 0x8B59;
    readonly FLOAT_MAT2: 0x8B5A;
    readonly FLOAT_MAT3: 0x8B5B;
    readonly FLOAT_MAT4: 0x8B5C;
    readonly SAMPLER_2D: 0x8B5E;
    readonly SAMPLER_CUBE: 0x8B60;
    readonly VERTEX_ATTRIB_ARRAY_ENABLED: 0x8622;
    readonly VERTEX_ATTRIB_ARRAY_SIZE: 0x8623;
    readonly VERTEX_ATTRIB_ARRAY_STRIDE: 0x8624;
    readonly VERTEX_ATTRIB_ARRAY_TYPE: 0x8625;
    readonly VERTEX_ATTRIB_ARRAY_NORMALIZED: 0x886A;
    readonly VERTEX_ATTRIB_ARRAY_POINTER: 0x8645;
    readonly VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 0x889F;
    readonly IMPLEMENTATION_COLOR_READ_TYPE: 0x8B9A;
    readonly IMPLEMENTATION_COLOR_READ_FORMAT: 0x8B9B;
    readonly COMPILE_STATUS: 0x8B81;
    readonly LOW_FLOAT: 0x8DF0;
    readonly MEDIUM_FLOAT: 0x8DF1;
    readonly HIGH_FLOAT: 0x8DF2;
    readonly LOW_INT: 0x8DF3;
    readonly MEDIUM_INT: 0x8DF4;
    readonly HIGH_INT: 0x8DF5;
    readonly FRAMEBUFFER: 0x8D40;
    readonly RENDERBUFFER: 0x8D41;
    readonly RGBA4: 0x8056;
    readonly RGB5_A1: 0x8057;
    readonly RGBA8: 0x8058;
    readonly RGB565: 0x8D62;
    readonly DEPTH_COMPONENT16: 0x81A5;
    readonly STENCIL_INDEX8: 0x8D48;
    readonly DEPTH_STENCIL: 0x84F9;
    readonly RENDERBUFFER_WIDTH: 0x8D42;
    readonly RENDERBUFFER_HEIGHT: 0x8D43;
    readonly RENDERBUFFER_INTERNAL_FORMAT: 0x8D44;
    readonly RENDERBUFFER_RED_SIZE: 0x8D50;
    readonly RENDERBUFFER_GREEN_SIZE: 0x8D51;
    readonly RENDERBUFFER_BLUE_SIZE: 0x8D52;
    readonly RENDERBUFFER_ALPHA_SIZE: 0x8D53;
    readonly RENDERBUFFER_DEPTH_SIZE: 0x8D54;
    readonly RENDERBUFFER_STENCIL_SIZE: 0x8D55;
    readonly FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 0x8CD0;
    readonly FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 0x8CD1;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 0x8CD2;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 0x8CD3;
    readonly COLOR_ATTACHMENT0: 0x8CE0;
    readonly DEPTH_ATTACHMENT: 0x8D00;
    readonly STENCIL_ATTACHMENT: 0x8D20;
    readonly DEPTH_STENCIL_ATTACHMENT: 0x821A;
    readonly NONE: 0;
    readonly FRAMEBUFFER_COMPLETE: 0x8CD5;
    readonly FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 0x8CD6;
    readonly FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 0x8CD7;
    readonly FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 0x8CD9;
    readonly FRAMEBUFFER_UNSUPPORTED: 0x8CDD;
    readonly FRAMEBUFFER_BINDING: 0x8CA6;
    readonly RENDERBUFFER_BINDING: 0x8CA7;
    readonly MAX_RENDERBUFFER_SIZE: 0x84E8;
    readonly INVALID_FRAMEBUFFER_OPERATION: 0x0506;
    readonly UNPACK_FLIP_Y_WEBGL: 0x9240;
    readonly UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241;
    readonly CONTEXT_LOST_WEBGL: 0x9242;
    readonly UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243;
    readonly BROWSER_DEFAULT_WEBGL: 0x9244;
};

interface WebGL2RenderingContextBase {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/beginQuery) */
    beginQuery(target: GLenum, query: WebGLQuery): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/beginTransformFeedback) */
    beginTransformFeedback(primitiveMode: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/bindBufferBase) */
    bindBufferBase(target: GLenum, index: GLuint, buffer: WebGLBuffer | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/bindBufferRange) */
    bindBufferRange(target: GLenum, index: GLuint, buffer: WebGLBuffer | null, offset: GLintptr, size: GLsizeiptr): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/bindSampler) */
    bindSampler(unit: GLuint, sampler: WebGLSampler | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/bindTransformFeedback) */
    bindTransformFeedback(target: GLenum, tf: WebGLTransformFeedback | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/bindVertexArray) */
    bindVertexArray(array: WebGLVertexArrayObject | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/blitFramebuffer) */
    blitFramebuffer(srcX0: GLint, srcY0: GLint, srcX1: GLint, srcY1: GLint, dstX0: GLint, dstY0: GLint, dstX1: GLint, dstY1: GLint, mask: GLbitfield, filter: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/clearBuffer) */
    clearBufferfi(buffer: GLenum, drawbuffer: GLint, depth: GLfloat, stencil: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/clearBuffer) */
    clearBufferfv(buffer: GLenum, drawbuffer: GLint, values: Float32List, srcOffset?: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/clearBuffer) */
    clearBufferiv(buffer: GLenum, drawbuffer: GLint, values: Int32List, srcOffset?: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/clearBuffer) */
    clearBufferuiv(buffer: GLenum, drawbuffer: GLint, values: Uint32List, srcOffset?: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/clientWaitSync) */
    clientWaitSync(sync: WebGLSync, flags: GLbitfield, timeout: GLuint64): GLenum;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/compressedTexImage3D) */
    compressedTexImage3D(target: GLenum, level: GLint, internalformat: GLenum, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, imageSize: GLsizei, offset: GLintptr): void;
    compressedTexImage3D(target: GLenum, level: GLint, internalformat: GLenum, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, srcData: ArrayBufferView, srcOffset?: number, srcLengthOverride?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/compressedTexSubImage3D) */
    compressedTexSubImage3D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, zoffset: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, format: GLenum, imageSize: GLsizei, offset: GLintptr): void;
    compressedTexSubImage3D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, zoffset: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, format: GLenum, srcData: ArrayBufferView, srcOffset?: number, srcLengthOverride?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/copyBufferSubData) */
    copyBufferSubData(readTarget: GLenum, writeTarget: GLenum, readOffset: GLintptr, writeOffset: GLintptr, size: GLsizeiptr): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/copyTexSubImage3D) */
    copyTexSubImage3D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, zoffset: GLint, x: GLint, y: GLint, width: GLsizei, height: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/createQuery) */
    createQuery(): WebGLQuery;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/createSampler) */
    createSampler(): WebGLSampler;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/createTransformFeedback) */
    createTransformFeedback(): WebGLTransformFeedback;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/createVertexArray) */
    createVertexArray(): WebGLVertexArrayObject;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/deleteQuery) */
    deleteQuery(query: WebGLQuery | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/deleteSampler) */
    deleteSampler(sampler: WebGLSampler | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/deleteSync) */
    deleteSync(sync: WebGLSync | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/deleteTransformFeedback) */
    deleteTransformFeedback(tf: WebGLTransformFeedback | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/deleteVertexArray) */
    deleteVertexArray(vertexArray: WebGLVertexArrayObject | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/drawArraysInstanced) */
    drawArraysInstanced(mode: GLenum, first: GLint, count: GLsizei, instanceCount: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/drawBuffers) */
    drawBuffers(buffers: GLenum[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/drawElementsInstanced) */
    drawElementsInstanced(mode: GLenum, count: GLsizei, type: GLenum, offset: GLintptr, instanceCount: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/drawRangeElements) */
    drawRangeElements(mode: GLenum, start: GLuint, end: GLuint, count: GLsizei, type: GLenum, offset: GLintptr): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/endQuery) */
    endQuery(target: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/endTransformFeedback) */
    endTransformFeedback(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/fenceSync) */
    fenceSync(condition: GLenum, flags: GLbitfield): WebGLSync | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/framebufferTextureLayer) */
    framebufferTextureLayer(target: GLenum, attachment: GLenum, texture: WebGLTexture | null, level: GLint, layer: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getActiveUniformBlockName) */
    getActiveUniformBlockName(program: WebGLProgram, uniformBlockIndex: GLuint): string | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getActiveUniformBlockParameter) */
    getActiveUniformBlockParameter(program: WebGLProgram, uniformBlockIndex: GLuint, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getActiveUniforms) */
    getActiveUniforms(program: WebGLProgram, uniformIndices: GLuint[], pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getBufferSubData) */
    getBufferSubData(target: GLenum, srcByteOffset: GLintptr, dstBuffer: ArrayBufferView, dstOffset?: number, length?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getFragDataLocation) */
    getFragDataLocation(program: WebGLProgram, name: string): GLint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getIndexedParameter) */
    getIndexedParameter(target: GLenum, index: GLuint): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getInternalformatParameter) */
    getInternalformatParameter(target: GLenum, internalformat: GLenum, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getQuery) */
    getQuery(target: GLenum, pname: GLenum): WebGLQuery | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getQueryParameter) */
    getQueryParameter(query: WebGLQuery, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getSamplerParameter) */
    getSamplerParameter(sampler: WebGLSampler, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getSyncParameter) */
    getSyncParameter(sync: WebGLSync, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getTransformFeedbackVarying) */
    getTransformFeedbackVarying(program: WebGLProgram, index: GLuint): WebGLActiveInfo | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getUniformBlockIndex) */
    getUniformBlockIndex(program: WebGLProgram, uniformBlockName: string): GLuint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/getUniformIndices) */
    getUniformIndices(program: WebGLProgram, uniformNames: string[]): GLuint[] | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/invalidateFramebuffer) */
    invalidateFramebuffer(target: GLenum, attachments: GLenum[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/invalidateSubFramebuffer) */
    invalidateSubFramebuffer(target: GLenum, attachments: GLenum[], x: GLint, y: GLint, width: GLsizei, height: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/isQuery) */
    isQuery(query: WebGLQuery | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/isSampler) */
    isSampler(sampler: WebGLSampler | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/isSync) */
    isSync(sync: WebGLSync | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/isTransformFeedback) */
    isTransformFeedback(tf: WebGLTransformFeedback | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/isVertexArray) */
    isVertexArray(vertexArray: WebGLVertexArrayObject | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/pauseTransformFeedback) */
    pauseTransformFeedback(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/readBuffer) */
    readBuffer(src: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/renderbufferStorageMultisample) */
    renderbufferStorageMultisample(target: GLenum, samples: GLsizei, internalformat: GLenum, width: GLsizei, height: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/resumeTransformFeedback) */
    resumeTransformFeedback(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/samplerParameter) */
    samplerParameterf(sampler: WebGLSampler, pname: GLenum, param: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/samplerParameter) */
    samplerParameteri(sampler: WebGLSampler, pname: GLenum, param: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/texImage3D) */
    texImage3D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, format: GLenum, type: GLenum, pboOffset: GLintptr): void;
    texImage3D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, format: GLenum, type: GLenum, source: TexImageSource): void;
    texImage3D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, format: GLenum, type: GLenum, srcData: ArrayBufferView | null): void;
    texImage3D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, border: GLint, format: GLenum, type: GLenum, srcData: ArrayBufferView, srcOffset: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/texStorage2D) */
    texStorage2D(target: GLenum, levels: GLsizei, internalformat: GLenum, width: GLsizei, height: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/texStorage3D) */
    texStorage3D(target: GLenum, levels: GLsizei, internalformat: GLenum, width: GLsizei, height: GLsizei, depth: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/texSubImage3D) */
    texSubImage3D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, zoffset: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, format: GLenum, type: GLenum, pboOffset: GLintptr): void;
    texSubImage3D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, zoffset: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, format: GLenum, type: GLenum, source: TexImageSource): void;
    texSubImage3D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, zoffset: GLint, width: GLsizei, height: GLsizei, depth: GLsizei, format: GLenum, type: GLenum, srcData: ArrayBufferView | null, srcOffset?: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/transformFeedbackVaryings) */
    transformFeedbackVaryings(program: WebGLProgram, varyings: string[], bufferMode: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniform) */
    uniform1ui(location: WebGLUniformLocation | null, v0: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniform) */
    uniform1uiv(location: WebGLUniformLocation | null, data: Uint32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniform) */
    uniform2ui(location: WebGLUniformLocation | null, v0: GLuint, v1: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniform) */
    uniform2uiv(location: WebGLUniformLocation | null, data: Uint32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniform) */
    uniform3ui(location: WebGLUniformLocation | null, v0: GLuint, v1: GLuint, v2: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniform) */
    uniform3uiv(location: WebGLUniformLocation | null, data: Uint32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniform) */
    uniform4ui(location: WebGLUniformLocation | null, v0: GLuint, v1: GLuint, v2: GLuint, v3: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniform) */
    uniform4uiv(location: WebGLUniformLocation | null, data: Uint32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniformBlockBinding) */
    uniformBlockBinding(program: WebGLProgram, uniformBlockIndex: GLuint, uniformBlockBinding: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniformMatrix) */
    uniformMatrix2x3fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniformMatrix) */
    uniformMatrix2x4fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniformMatrix) */
    uniformMatrix3x2fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniformMatrix) */
    uniformMatrix3x4fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniformMatrix) */
    uniformMatrix4x2fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniformMatrix) */
    uniformMatrix4x3fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/vertexAttribDivisor) */
    vertexAttribDivisor(index: GLuint, divisor: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/vertexAttribI) */
    vertexAttribI4i(index: GLuint, x: GLint, y: GLint, z: GLint, w: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/vertexAttribI) */
    vertexAttribI4iv(index: GLuint, values: Int32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/vertexAttribI) */
    vertexAttribI4ui(index: GLuint, x: GLuint, y: GLuint, z: GLuint, w: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/vertexAttribI) */
    vertexAttribI4uiv(index: GLuint, values: Uint32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/vertexAttribIPointer) */
    vertexAttribIPointer(index: GLuint, size: GLint, type: GLenum, stride: GLsizei, offset: GLintptr): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/waitSync) */
    waitSync(sync: WebGLSync, flags: GLbitfield, timeout: GLint64): void;
    readonly READ_BUFFER: 0x0C02;
    readonly UNPACK_ROW_LENGTH: 0x0CF2;
    readonly UNPACK_SKIP_ROWS: 0x0CF3;
    readonly UNPACK_SKIP_PIXELS: 0x0CF4;
    readonly PACK_ROW_LENGTH: 0x0D02;
    readonly PACK_SKIP_ROWS: 0x0D03;
    readonly PACK_SKIP_PIXELS: 0x0D04;
    readonly COLOR: 0x1800;
    readonly DEPTH: 0x1801;
    readonly STENCIL: 0x1802;
    readonly RED: 0x1903;
    readonly RGB8: 0x8051;
    readonly RGB10_A2: 0x8059;
    readonly TEXTURE_BINDING_3D: 0x806A;
    readonly UNPACK_SKIP_IMAGES: 0x806D;
    readonly UNPACK_IMAGE_HEIGHT: 0x806E;
    readonly TEXTURE_3D: 0x806F;
    readonly TEXTURE_WRAP_R: 0x8072;
    readonly MAX_3D_TEXTURE_SIZE: 0x8073;
    readonly UNSIGNED_INT_2_10_10_10_REV: 0x8368;
    readonly MAX_ELEMENTS_VERTICES: 0x80E8;
    readonly MAX_ELEMENTS_INDICES: 0x80E9;
    readonly TEXTURE_MIN_LOD: 0x813A;
    readonly TEXTURE_MAX_LOD: 0x813B;
    readonly TEXTURE_BASE_LEVEL: 0x813C;
    readonly TEXTURE_MAX_LEVEL: 0x813D;
    readonly MIN: 0x8007;
    readonly MAX: 0x8008;
    readonly DEPTH_COMPONENT24: 0x81A6;
    readonly MAX_TEXTURE_LOD_BIAS: 0x84FD;
    readonly TEXTURE_COMPARE_MODE: 0x884C;
    readonly TEXTURE_COMPARE_FUNC: 0x884D;
    readonly CURRENT_QUERY: 0x8865;
    readonly QUERY_RESULT: 0x8866;
    readonly QUERY_RESULT_AVAILABLE: 0x8867;
    readonly STREAM_READ: 0x88E1;
    readonly STREAM_COPY: 0x88E2;
    readonly STATIC_READ: 0x88E5;
    readonly STATIC_COPY: 0x88E6;
    readonly DYNAMIC_READ: 0x88E9;
    readonly DYNAMIC_COPY: 0x88EA;
    readonly MAX_DRAW_BUFFERS: 0x8824;
    readonly DRAW_BUFFER0: 0x8825;
    readonly DRAW_BUFFER1: 0x8826;
    readonly DRAW_BUFFER2: 0x8827;
    readonly DRAW_BUFFER3: 0x8828;
    readonly DRAW_BUFFER4: 0x8829;
    readonly DRAW_BUFFER5: 0x882A;
    readonly DRAW_BUFFER6: 0x882B;
    readonly DRAW_BUFFER7: 0x882C;
    readonly DRAW_BUFFER8: 0x882D;
    readonly DRAW_BUFFER9: 0x882E;
    readonly DRAW_BUFFER10: 0x882F;
    readonly DRAW_BUFFER11: 0x8830;
    readonly DRAW_BUFFER12: 0x8831;
    readonly DRAW_BUFFER13: 0x8832;
    readonly DRAW_BUFFER14: 0x8833;
    readonly DRAW_BUFFER15: 0x8834;
    readonly MAX_FRAGMENT_UNIFORM_COMPONENTS: 0x8B49;
    readonly MAX_VERTEX_UNIFORM_COMPONENTS: 0x8B4A;
    readonly SAMPLER_3D: 0x8B5F;
    readonly SAMPLER_2D_SHADOW: 0x8B62;
    readonly FRAGMENT_SHADER_DERIVATIVE_HINT: 0x8B8B;
    readonly PIXEL_PACK_BUFFER: 0x88EB;
    readonly PIXEL_UNPACK_BUFFER: 0x88EC;
    readonly PIXEL_PACK_BUFFER_BINDING: 0x88ED;
    readonly PIXEL_UNPACK_BUFFER_BINDING: 0x88EF;
    readonly FLOAT_MAT2x3: 0x8B65;
    readonly FLOAT_MAT2x4: 0x8B66;
    readonly FLOAT_MAT3x2: 0x8B67;
    readonly FLOAT_MAT3x4: 0x8B68;
    readonly FLOAT_MAT4x2: 0x8B69;
    readonly FLOAT_MAT4x3: 0x8B6A;
    readonly SRGB: 0x8C40;
    readonly SRGB8: 0x8C41;
    readonly SRGB8_ALPHA8: 0x8C43;
    readonly COMPARE_REF_TO_TEXTURE: 0x884E;
    readonly RGBA32F: 0x8814;
    readonly RGB32F: 0x8815;
    readonly RGBA16F: 0x881A;
    readonly RGB16F: 0x881B;
    readonly VERTEX_ATTRIB_ARRAY_INTEGER: 0x88FD;
    readonly MAX_ARRAY_TEXTURE_LAYERS: 0x88FF;
    readonly MIN_PROGRAM_TEXEL_OFFSET: 0x8904;
    readonly MAX_PROGRAM_TEXEL_OFFSET: 0x8905;
    readonly MAX_VARYING_COMPONENTS: 0x8B4B;
    readonly TEXTURE_2D_ARRAY: 0x8C1A;
    readonly TEXTURE_BINDING_2D_ARRAY: 0x8C1D;
    readonly R11F_G11F_B10F: 0x8C3A;
    readonly UNSIGNED_INT_10F_11F_11F_REV: 0x8C3B;
    readonly RGB9_E5: 0x8C3D;
    readonly UNSIGNED_INT_5_9_9_9_REV: 0x8C3E;
    readonly TRANSFORM_FEEDBACK_BUFFER_MODE: 0x8C7F;
    readonly MAX_TRANSFORM_FEEDBACK_SEPARATE_COMPONENTS: 0x8C80;
    readonly TRANSFORM_FEEDBACK_VARYINGS: 0x8C83;
    readonly TRANSFORM_FEEDBACK_BUFFER_START: 0x8C84;
    readonly TRANSFORM_FEEDBACK_BUFFER_SIZE: 0x8C85;
    readonly TRANSFORM_FEEDBACK_PRIMITIVES_WRITTEN: 0x8C88;
    readonly RASTERIZER_DISCARD: 0x8C89;
    readonly MAX_TRANSFORM_FEEDBACK_INTERLEAVED_COMPONENTS: 0x8C8A;
    readonly MAX_TRANSFORM_FEEDBACK_SEPARATE_ATTRIBS: 0x8C8B;
    readonly INTERLEAVED_ATTRIBS: 0x8C8C;
    readonly SEPARATE_ATTRIBS: 0x8C8D;
    readonly TRANSFORM_FEEDBACK_BUFFER: 0x8C8E;
    readonly TRANSFORM_FEEDBACK_BUFFER_BINDING: 0x8C8F;
    readonly RGBA32UI: 0x8D70;
    readonly RGB32UI: 0x8D71;
    readonly RGBA16UI: 0x8D76;
    readonly RGB16UI: 0x8D77;
    readonly RGBA8UI: 0x8D7C;
    readonly RGB8UI: 0x8D7D;
    readonly RGBA32I: 0x8D82;
    readonly RGB32I: 0x8D83;
    readonly RGBA16I: 0x8D88;
    readonly RGB16I: 0x8D89;
    readonly RGBA8I: 0x8D8E;
    readonly RGB8I: 0x8D8F;
    readonly RED_INTEGER: 0x8D94;
    readonly RGB_INTEGER: 0x8D98;
    readonly RGBA_INTEGER: 0x8D99;
    readonly SAMPLER_2D_ARRAY: 0x8DC1;
    readonly SAMPLER_2D_ARRAY_SHADOW: 0x8DC4;
    readonly SAMPLER_CUBE_SHADOW: 0x8DC5;
    readonly UNSIGNED_INT_VEC2: 0x8DC6;
    readonly UNSIGNED_INT_VEC3: 0x8DC7;
    readonly UNSIGNED_INT_VEC4: 0x8DC8;
    readonly INT_SAMPLER_2D: 0x8DCA;
    readonly INT_SAMPLER_3D: 0x8DCB;
    readonly INT_SAMPLER_CUBE: 0x8DCC;
    readonly INT_SAMPLER_2D_ARRAY: 0x8DCF;
    readonly UNSIGNED_INT_SAMPLER_2D: 0x8DD2;
    readonly UNSIGNED_INT_SAMPLER_3D: 0x8DD3;
    readonly UNSIGNED_INT_SAMPLER_CUBE: 0x8DD4;
    readonly UNSIGNED_INT_SAMPLER_2D_ARRAY: 0x8DD7;
    readonly DEPTH_COMPONENT32F: 0x8CAC;
    readonly DEPTH32F_STENCIL8: 0x8CAD;
    readonly FLOAT_32_UNSIGNED_INT_24_8_REV: 0x8DAD;
    readonly FRAMEBUFFER_ATTACHMENT_COLOR_ENCODING: 0x8210;
    readonly FRAMEBUFFER_ATTACHMENT_COMPONENT_TYPE: 0x8211;
    readonly FRAMEBUFFER_ATTACHMENT_RED_SIZE: 0x8212;
    readonly FRAMEBUFFER_ATTACHMENT_GREEN_SIZE: 0x8213;
    readonly FRAMEBUFFER_ATTACHMENT_BLUE_SIZE: 0x8214;
    readonly FRAMEBUFFER_ATTACHMENT_ALPHA_SIZE: 0x8215;
    readonly FRAMEBUFFER_ATTACHMENT_DEPTH_SIZE: 0x8216;
    readonly FRAMEBUFFER_ATTACHMENT_STENCIL_SIZE: 0x8217;
    readonly FRAMEBUFFER_DEFAULT: 0x8218;
    readonly UNSIGNED_INT_24_8: 0x84FA;
    readonly DEPTH24_STENCIL8: 0x88F0;
    readonly UNSIGNED_NORMALIZED: 0x8C17;
    readonly DRAW_FRAMEBUFFER_BINDING: 0x8CA6;
    readonly READ_FRAMEBUFFER: 0x8CA8;
    readonly DRAW_FRAMEBUFFER: 0x8CA9;
    readonly READ_FRAMEBUFFER_BINDING: 0x8CAA;
    readonly RENDERBUFFER_SAMPLES: 0x8CAB;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_LAYER: 0x8CD4;
    readonly MAX_COLOR_ATTACHMENTS: 0x8CDF;
    readonly COLOR_ATTACHMENT1: 0x8CE1;
    readonly COLOR_ATTACHMENT2: 0x8CE2;
    readonly COLOR_ATTACHMENT3: 0x8CE3;
    readonly COLOR_ATTACHMENT4: 0x8CE4;
    readonly COLOR_ATTACHMENT5: 0x8CE5;
    readonly COLOR_ATTACHMENT6: 0x8CE6;
    readonly COLOR_ATTACHMENT7: 0x8CE7;
    readonly COLOR_ATTACHMENT8: 0x8CE8;
    readonly COLOR_ATTACHMENT9: 0x8CE9;
    readonly COLOR_ATTACHMENT10: 0x8CEA;
    readonly COLOR_ATTACHMENT11: 0x8CEB;
    readonly COLOR_ATTACHMENT12: 0x8CEC;
    readonly COLOR_ATTACHMENT13: 0x8CED;
    readonly COLOR_ATTACHMENT14: 0x8CEE;
    readonly COLOR_ATTACHMENT15: 0x8CEF;
    readonly FRAMEBUFFER_INCOMPLETE_MULTISAMPLE: 0x8D56;
    readonly MAX_SAMPLES: 0x8D57;
    readonly HALF_FLOAT: 0x140B;
    readonly RG: 0x8227;
    readonly RG_INTEGER: 0x8228;
    readonly R8: 0x8229;
    readonly RG8: 0x822B;
    readonly R16F: 0x822D;
    readonly R32F: 0x822E;
    readonly RG16F: 0x822F;
    readonly RG32F: 0x8230;
    readonly R8I: 0x8231;
    readonly R8UI: 0x8232;
    readonly R16I: 0x8233;
    readonly R16UI: 0x8234;
    readonly R32I: 0x8235;
    readonly R32UI: 0x8236;
    readonly RG8I: 0x8237;
    readonly RG8UI: 0x8238;
    readonly RG16I: 0x8239;
    readonly RG16UI: 0x823A;
    readonly RG32I: 0x823B;
    readonly RG32UI: 0x823C;
    readonly VERTEX_ARRAY_BINDING: 0x85B5;
    readonly R8_SNORM: 0x8F94;
    readonly RG8_SNORM: 0x8F95;
    readonly RGB8_SNORM: 0x8F96;
    readonly RGBA8_SNORM: 0x8F97;
    readonly SIGNED_NORMALIZED: 0x8F9C;
    readonly COPY_READ_BUFFER: 0x8F36;
    readonly COPY_WRITE_BUFFER: 0x8F37;
    readonly COPY_READ_BUFFER_BINDING: 0x8F36;
    readonly COPY_WRITE_BUFFER_BINDING: 0x8F37;
    readonly UNIFORM_BUFFER: 0x8A11;
    readonly UNIFORM_BUFFER_BINDING: 0x8A28;
    readonly UNIFORM_BUFFER_START: 0x8A29;
    readonly UNIFORM_BUFFER_SIZE: 0x8A2A;
    readonly MAX_VERTEX_UNIFORM_BLOCKS: 0x8A2B;
    readonly MAX_FRAGMENT_UNIFORM_BLOCKS: 0x8A2D;
    readonly MAX_COMBINED_UNIFORM_BLOCKS: 0x8A2E;
    readonly MAX_UNIFORM_BUFFER_BINDINGS: 0x8A2F;
    readonly MAX_UNIFORM_BLOCK_SIZE: 0x8A30;
    readonly MAX_COMBINED_VERTEX_UNIFORM_COMPONENTS: 0x8A31;
    readonly MAX_COMBINED_FRAGMENT_UNIFORM_COMPONENTS: 0x8A33;
    readonly UNIFORM_BUFFER_OFFSET_ALIGNMENT: 0x8A34;
    readonly ACTIVE_UNIFORM_BLOCKS: 0x8A36;
    readonly UNIFORM_TYPE: 0x8A37;
    readonly UNIFORM_SIZE: 0x8A38;
    readonly UNIFORM_BLOCK_INDEX: 0x8A3A;
    readonly UNIFORM_OFFSET: 0x8A3B;
    readonly UNIFORM_ARRAY_STRIDE: 0x8A3C;
    readonly UNIFORM_MATRIX_STRIDE: 0x8A3D;
    readonly UNIFORM_IS_ROW_MAJOR: 0x8A3E;
    readonly UNIFORM_BLOCK_BINDING: 0x8A3F;
    readonly UNIFORM_BLOCK_DATA_SIZE: 0x8A40;
    readonly UNIFORM_BLOCK_ACTIVE_UNIFORMS: 0x8A42;
    readonly UNIFORM_BLOCK_ACTIVE_UNIFORM_INDICES: 0x8A43;
    readonly UNIFORM_BLOCK_REFERENCED_BY_VERTEX_SHADER: 0x8A44;
    readonly UNIFORM_BLOCK_REFERENCED_BY_FRAGMENT_SHADER: 0x8A46;
    readonly INVALID_INDEX: 0xFFFFFFFF;
    readonly MAX_VERTEX_OUTPUT_COMPONENTS: 0x9122;
    readonly MAX_FRAGMENT_INPUT_COMPONENTS: 0x9125;
    readonly MAX_SERVER_WAIT_TIMEOUT: 0x9111;
    readonly OBJECT_TYPE: 0x9112;
    readonly SYNC_CONDITION: 0x9113;
    readonly SYNC_STATUS: 0x9114;
    readonly SYNC_FLAGS: 0x9115;
    readonly SYNC_FENCE: 0x9116;
    readonly SYNC_GPU_COMMANDS_COMPLETE: 0x9117;
    readonly UNSIGNALED: 0x9118;
    readonly SIGNALED: 0x9119;
    readonly ALREADY_SIGNALED: 0x911A;
    readonly TIMEOUT_EXPIRED: 0x911B;
    readonly CONDITION_SATISFIED: 0x911C;
    readonly WAIT_FAILED: 0x911D;
    readonly SYNC_FLUSH_COMMANDS_BIT: 0x00000001;
    readonly VERTEX_ATTRIB_ARRAY_DIVISOR: 0x88FE;
    readonly ANY_SAMPLES_PASSED: 0x8C2F;
    readonly ANY_SAMPLES_PASSED_CONSERVATIVE: 0x8D6A;
    readonly SAMPLER_BINDING: 0x8919;
    readonly RGB10_A2UI: 0x906F;
    readonly INT_2_10_10_10_REV: 0x8D9F;
    readonly TRANSFORM_FEEDBACK: 0x8E22;
    readonly TRANSFORM_FEEDBACK_PAUSED: 0x8E23;
    readonly TRANSFORM_FEEDBACK_ACTIVE: 0x8E24;
    readonly TRANSFORM_FEEDBACK_BINDING: 0x8E25;
    readonly TEXTURE_IMMUTABLE_FORMAT: 0x912F;
    readonly MAX_ELEMENT_INDEX: 0x8D6B;
    readonly TEXTURE_IMMUTABLE_LEVELS: 0x82DF;
    readonly TIMEOUT_IGNORED: -1;
    readonly MAX_CLIENT_WAIT_TIMEOUT_WEBGL: 0x9247;
}

interface WebGL2RenderingContextOverloads {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/bufferData) */
    bufferData(target: GLenum, size: GLsizeiptr, usage: GLenum): void;
    bufferData(target: GLenum, srcData: AllowSharedBufferSource | null, usage: GLenum): void;
    bufferData(target: GLenum, srcData: ArrayBufferView, usage: GLenum, srcOffset: number, length?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/bufferSubData) */
    bufferSubData(target: GLenum, dstByteOffset: GLintptr, srcData: AllowSharedBufferSource): void;
    bufferSubData(target: GLenum, dstByteOffset: GLintptr, srcData: ArrayBufferView, srcOffset: number, length?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/compressedTexImage2D) */
    compressedTexImage2D(target: GLenum, level: GLint, internalformat: GLenum, width: GLsizei, height: GLsizei, border: GLint, imageSize: GLsizei, offset: GLintptr): void;
    compressedTexImage2D(target: GLenum, level: GLint, internalformat: GLenum, width: GLsizei, height: GLsizei, border: GLint, srcData: ArrayBufferView, srcOffset?: number, srcLengthOverride?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/compressedTexSubImage2D) */
    compressedTexSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, width: GLsizei, height: GLsizei, format: GLenum, imageSize: GLsizei, offset: GLintptr): void;
    compressedTexSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, width: GLsizei, height: GLsizei, format: GLenum, srcData: ArrayBufferView, srcOffset?: number, srcLengthOverride?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/readPixels) */
    readPixels(x: GLint, y: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, dstData: ArrayBufferView | null): void;
    readPixels(x: GLint, y: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, offset: GLintptr): void;
    readPixels(x: GLint, y: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, dstData: ArrayBufferView, dstOffset: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/texImage2D) */
    texImage2D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: ArrayBufferView | null): void;
    texImage2D(target: GLenum, level: GLint, internalformat: GLint, format: GLenum, type: GLenum, source: TexImageSource): void;
    texImage2D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, format: GLenum, type: GLenum, pboOffset: GLintptr): void;
    texImage2D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, format: GLenum, type: GLenum, source: TexImageSource): void;
    texImage2D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, format: GLenum, type: GLenum, srcData: ArrayBufferView, srcOffset: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/texSubImage2D) */
    texSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, pixels: ArrayBufferView | null): void;
    texSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, format: GLenum, type: GLenum, source: TexImageSource): void;
    texSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, pboOffset: GLintptr): void;
    texSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, source: TexImageSource): void;
    texSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, srcData: ArrayBufferView, srcOffset: number): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform1fv(location: WebGLUniformLocation | null, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform1iv(location: WebGLUniformLocation | null, data: Int32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform2fv(location: WebGLUniformLocation | null, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform2iv(location: WebGLUniformLocation | null, data: Int32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform3fv(location: WebGLUniformLocation | null, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform3iv(location: WebGLUniformLocation | null, data: Int32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform4fv(location: WebGLUniformLocation | null, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform4iv(location: WebGLUniformLocation | null, data: Int32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/uniformMatrix) */
    uniformMatrix2fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniformMatrix) */
    uniformMatrix3fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniformMatrix) */
    uniformMatrix4fv(location: WebGLUniformLocation | null, transpose: GLboolean, data: Float32List, srcOffset?: number, srcLength?: GLuint): void;
}

/**
 * Part of the WebGL API and represents the information returned by calling the WebGLRenderingContext.getActiveAttrib() and WebGLRenderingContext.getActiveUniform() methods.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLActiveInfo)
 */
interface WebGLActiveInfo {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLActiveInfo/name) */
    readonly name: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLActiveInfo/size) */
    readonly size: GLint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLActiveInfo/type) */
    readonly type: GLenum;
}

declare var WebGLActiveInfo: {
    prototype: WebGLActiveInfo;
    new(): WebGLActiveInfo;
};

/**
 * Part of the WebGL API and represents an opaque buffer object storing data such as vertices or colors.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLBuffer)
 */
interface WebGLBuffer {
}

declare var WebGLBuffer: {
    prototype: WebGLBuffer;
    new(): WebGLBuffer;
};

/**
 * The WebContextEvent interface is part of the WebGL API and is an interface for an event that is generated in response to a status change to the WebGL rendering context.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLContextEvent)
 */
interface WebGLContextEvent extends Event {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLContextEvent/statusMessage) */
    readonly statusMessage: string;
}

declare var WebGLContextEvent: {
    prototype: WebGLContextEvent;
    new(type: string, eventInit?: WebGLContextEventInit): WebGLContextEvent;
};

/**
 * Part of the WebGL API and represents a collection of buffers that serve as a rendering destination.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLFramebuffer)
 */
interface WebGLFramebuffer {
}

declare var WebGLFramebuffer: {
    prototype: WebGLFramebuffer;
    new(): WebGLFramebuffer;
};

/**
 * The WebGLProgram is part of the WebGL API and is a combination of two compiled WebGLShaders consisting of a vertex shader and a fragment shader (both written in GLSL).
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLProgram)
 */
interface WebGLProgram {
}

declare var WebGLProgram: {
    prototype: WebGLProgram;
    new(): WebGLProgram;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLQuery) */
interface WebGLQuery {
}

declare var WebGLQuery: {
    prototype: WebGLQuery;
    new(): WebGLQuery;
};

/**
 * Part of the WebGL API and represents a buffer that can contain an image, or can be source or target of an rendering operation.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderbuffer)
 */
interface WebGLRenderbuffer {
}

declare var WebGLRenderbuffer: {
    prototype: WebGLRenderbuffer;
    new(): WebGLRenderbuffer;
};

/**
 * Provides an interface to the OpenGL ES 2.0 graphics rendering context for the drawing surface of an HTML <canvas> element.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext)
 */
interface WebGLRenderingContext extends WebGLRenderingContextBase, WebGLRenderingContextOverloads {
}

declare var WebGLRenderingContext: {
    prototype: WebGLRenderingContext;
    new(): WebGLRenderingContext;
    readonly DEPTH_BUFFER_BIT: 0x00000100;
    readonly STENCIL_BUFFER_BIT: 0x00000400;
    readonly COLOR_BUFFER_BIT: 0x00004000;
    readonly POINTS: 0x0000;
    readonly LINES: 0x0001;
    readonly LINE_LOOP: 0x0002;
    readonly LINE_STRIP: 0x0003;
    readonly TRIANGLES: 0x0004;
    readonly TRIANGLE_STRIP: 0x0005;
    readonly TRIANGLE_FAN: 0x0006;
    readonly ZERO: 0;
    readonly ONE: 1;
    readonly SRC_COLOR: 0x0300;
    readonly ONE_MINUS_SRC_COLOR: 0x0301;
    readonly SRC_ALPHA: 0x0302;
    readonly ONE_MINUS_SRC_ALPHA: 0x0303;
    readonly DST_ALPHA: 0x0304;
    readonly ONE_MINUS_DST_ALPHA: 0x0305;
    readonly DST_COLOR: 0x0306;
    readonly ONE_MINUS_DST_COLOR: 0x0307;
    readonly SRC_ALPHA_SATURATE: 0x0308;
    readonly FUNC_ADD: 0x8006;
    readonly BLEND_EQUATION: 0x8009;
    readonly BLEND_EQUATION_RGB: 0x8009;
    readonly BLEND_EQUATION_ALPHA: 0x883D;
    readonly FUNC_SUBTRACT: 0x800A;
    readonly FUNC_REVERSE_SUBTRACT: 0x800B;
    readonly BLEND_DST_RGB: 0x80C8;
    readonly BLEND_SRC_RGB: 0x80C9;
    readonly BLEND_DST_ALPHA: 0x80CA;
    readonly BLEND_SRC_ALPHA: 0x80CB;
    readonly CONSTANT_COLOR: 0x8001;
    readonly ONE_MINUS_CONSTANT_COLOR: 0x8002;
    readonly CONSTANT_ALPHA: 0x8003;
    readonly ONE_MINUS_CONSTANT_ALPHA: 0x8004;
    readonly BLEND_COLOR: 0x8005;
    readonly ARRAY_BUFFER: 0x8892;
    readonly ELEMENT_ARRAY_BUFFER: 0x8893;
    readonly ARRAY_BUFFER_BINDING: 0x8894;
    readonly ELEMENT_ARRAY_BUFFER_BINDING: 0x8895;
    readonly STREAM_DRAW: 0x88E0;
    readonly STATIC_DRAW: 0x88E4;
    readonly DYNAMIC_DRAW: 0x88E8;
    readonly BUFFER_SIZE: 0x8764;
    readonly BUFFER_USAGE: 0x8765;
    readonly CURRENT_VERTEX_ATTRIB: 0x8626;
    readonly FRONT: 0x0404;
    readonly BACK: 0x0405;
    readonly FRONT_AND_BACK: 0x0408;
    readonly CULL_FACE: 0x0B44;
    readonly BLEND: 0x0BE2;
    readonly DITHER: 0x0BD0;
    readonly STENCIL_TEST: 0x0B90;
    readonly DEPTH_TEST: 0x0B71;
    readonly SCISSOR_TEST: 0x0C11;
    readonly POLYGON_OFFSET_FILL: 0x8037;
    readonly SAMPLE_ALPHA_TO_COVERAGE: 0x809E;
    readonly SAMPLE_COVERAGE: 0x80A0;
    readonly NO_ERROR: 0;
    readonly INVALID_ENUM: 0x0500;
    readonly INVALID_VALUE: 0x0501;
    readonly INVALID_OPERATION: 0x0502;
    readonly OUT_OF_MEMORY: 0x0505;
    readonly CW: 0x0900;
    readonly CCW: 0x0901;
    readonly LINE_WIDTH: 0x0B21;
    readonly ALIASED_POINT_SIZE_RANGE: 0x846D;
    readonly ALIASED_LINE_WIDTH_RANGE: 0x846E;
    readonly CULL_FACE_MODE: 0x0B45;
    readonly FRONT_FACE: 0x0B46;
    readonly DEPTH_RANGE: 0x0B70;
    readonly DEPTH_WRITEMASK: 0x0B72;
    readonly DEPTH_CLEAR_VALUE: 0x0B73;
    readonly DEPTH_FUNC: 0x0B74;
    readonly STENCIL_CLEAR_VALUE: 0x0B91;
    readonly STENCIL_FUNC: 0x0B92;
    readonly STENCIL_FAIL: 0x0B94;
    readonly STENCIL_PASS_DEPTH_FAIL: 0x0B95;
    readonly STENCIL_PASS_DEPTH_PASS: 0x0B96;
    readonly STENCIL_REF: 0x0B97;
    readonly STENCIL_VALUE_MASK: 0x0B93;
    readonly STENCIL_WRITEMASK: 0x0B98;
    readonly STENCIL_BACK_FUNC: 0x8800;
    readonly STENCIL_BACK_FAIL: 0x8801;
    readonly STENCIL_BACK_PASS_DEPTH_FAIL: 0x8802;
    readonly STENCIL_BACK_PASS_DEPTH_PASS: 0x8803;
    readonly STENCIL_BACK_REF: 0x8CA3;
    readonly STENCIL_BACK_VALUE_MASK: 0x8CA4;
    readonly STENCIL_BACK_WRITEMASK: 0x8CA5;
    readonly VIEWPORT: 0x0BA2;
    readonly SCISSOR_BOX: 0x0C10;
    readonly COLOR_CLEAR_VALUE: 0x0C22;
    readonly COLOR_WRITEMASK: 0x0C23;
    readonly UNPACK_ALIGNMENT: 0x0CF5;
    readonly PACK_ALIGNMENT: 0x0D05;
    readonly MAX_TEXTURE_SIZE: 0x0D33;
    readonly MAX_VIEWPORT_DIMS: 0x0D3A;
    readonly SUBPIXEL_BITS: 0x0D50;
    readonly RED_BITS: 0x0D52;
    readonly GREEN_BITS: 0x0D53;
    readonly BLUE_BITS: 0x0D54;
    readonly ALPHA_BITS: 0x0D55;
    readonly DEPTH_BITS: 0x0D56;
    readonly STENCIL_BITS: 0x0D57;
    readonly POLYGON_OFFSET_UNITS: 0x2A00;
    readonly POLYGON_OFFSET_FACTOR: 0x8038;
    readonly TEXTURE_BINDING_2D: 0x8069;
    readonly SAMPLE_BUFFERS: 0x80A8;
    readonly SAMPLES: 0x80A9;
    readonly SAMPLE_COVERAGE_VALUE: 0x80AA;
    readonly SAMPLE_COVERAGE_INVERT: 0x80AB;
    readonly COMPRESSED_TEXTURE_FORMATS: 0x86A3;
    readonly DONT_CARE: 0x1100;
    readonly FASTEST: 0x1101;
    readonly NICEST: 0x1102;
    readonly GENERATE_MIPMAP_HINT: 0x8192;
    readonly BYTE: 0x1400;
    readonly UNSIGNED_BYTE: 0x1401;
    readonly SHORT: 0x1402;
    readonly UNSIGNED_SHORT: 0x1403;
    readonly INT: 0x1404;
    readonly UNSIGNED_INT: 0x1405;
    readonly FLOAT: 0x1406;
    readonly DEPTH_COMPONENT: 0x1902;
    readonly ALPHA: 0x1906;
    readonly RGB: 0x1907;
    readonly RGBA: 0x1908;
    readonly LUMINANCE: 0x1909;
    readonly LUMINANCE_ALPHA: 0x190A;
    readonly UNSIGNED_SHORT_4_4_4_4: 0x8033;
    readonly UNSIGNED_SHORT_5_5_5_1: 0x8034;
    readonly UNSIGNED_SHORT_5_6_5: 0x8363;
    readonly FRAGMENT_SHADER: 0x8B30;
    readonly VERTEX_SHADER: 0x8B31;
    readonly MAX_VERTEX_ATTRIBS: 0x8869;
    readonly MAX_VERTEX_UNIFORM_VECTORS: 0x8DFB;
    readonly MAX_VARYING_VECTORS: 0x8DFC;
    readonly MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8B4D;
    readonly MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8B4C;
    readonly MAX_TEXTURE_IMAGE_UNITS: 0x8872;
    readonly MAX_FRAGMENT_UNIFORM_VECTORS: 0x8DFD;
    readonly SHADER_TYPE: 0x8B4F;
    readonly DELETE_STATUS: 0x8B80;
    readonly LINK_STATUS: 0x8B82;
    readonly VALIDATE_STATUS: 0x8B83;
    readonly ATTACHED_SHADERS: 0x8B85;
    readonly ACTIVE_UNIFORMS: 0x8B86;
    readonly ACTIVE_ATTRIBUTES: 0x8B89;
    readonly SHADING_LANGUAGE_VERSION: 0x8B8C;
    readonly CURRENT_PROGRAM: 0x8B8D;
    readonly NEVER: 0x0200;
    readonly LESS: 0x0201;
    readonly EQUAL: 0x0202;
    readonly LEQUAL: 0x0203;
    readonly GREATER: 0x0204;
    readonly NOTEQUAL: 0x0205;
    readonly GEQUAL: 0x0206;
    readonly ALWAYS: 0x0207;
    readonly KEEP: 0x1E00;
    readonly REPLACE: 0x1E01;
    readonly INCR: 0x1E02;
    readonly DECR: 0x1E03;
    readonly INVERT: 0x150A;
    readonly INCR_WRAP: 0x8507;
    readonly DECR_WRAP: 0x8508;
    readonly VENDOR: 0x1F00;
    readonly RENDERER: 0x1F01;
    readonly VERSION: 0x1F02;
    readonly NEAREST: 0x2600;
    readonly LINEAR: 0x2601;
    readonly NEAREST_MIPMAP_NEAREST: 0x2700;
    readonly LINEAR_MIPMAP_NEAREST: 0x2701;
    readonly NEAREST_MIPMAP_LINEAR: 0x2702;
    readonly LINEAR_MIPMAP_LINEAR: 0x2703;
    readonly TEXTURE_MAG_FILTER: 0x2800;
    readonly TEXTURE_MIN_FILTER: 0x2801;
    readonly TEXTURE_WRAP_S: 0x2802;
    readonly TEXTURE_WRAP_T: 0x2803;
    readonly TEXTURE_2D: 0x0DE1;
    readonly TEXTURE: 0x1702;
    readonly TEXTURE_CUBE_MAP: 0x8513;
    readonly TEXTURE_BINDING_CUBE_MAP: 0x8514;
    readonly TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_X: 0x8516;
    readonly TEXTURE_CUBE_MAP_POSITIVE_Y: 0x8517;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_Y: 0x8518;
    readonly TEXTURE_CUBE_MAP_POSITIVE_Z: 0x8519;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_Z: 0x851A;
    readonly MAX_CUBE_MAP_TEXTURE_SIZE: 0x851C;
    readonly TEXTURE0: 0x84C0;
    readonly TEXTURE1: 0x84C1;
    readonly TEXTURE2: 0x84C2;
    readonly TEXTURE3: 0x84C3;
    readonly TEXTURE4: 0x84C4;
    readonly TEXTURE5: 0x84C5;
    readonly TEXTURE6: 0x84C6;
    readonly TEXTURE7: 0x84C7;
    readonly TEXTURE8: 0x84C8;
    readonly TEXTURE9: 0x84C9;
    readonly TEXTURE10: 0x84CA;
    readonly TEXTURE11: 0x84CB;
    readonly TEXTURE12: 0x84CC;
    readonly TEXTURE13: 0x84CD;
    readonly TEXTURE14: 0x84CE;
    readonly TEXTURE15: 0x84CF;
    readonly TEXTURE16: 0x84D0;
    readonly TEXTURE17: 0x84D1;
    readonly TEXTURE18: 0x84D2;
    readonly TEXTURE19: 0x84D3;
    readonly TEXTURE20: 0x84D4;
    readonly TEXTURE21: 0x84D5;
    readonly TEXTURE22: 0x84D6;
    readonly TEXTURE23: 0x84D7;
    readonly TEXTURE24: 0x84D8;
    readonly TEXTURE25: 0x84D9;
    readonly TEXTURE26: 0x84DA;
    readonly TEXTURE27: 0x84DB;
    readonly TEXTURE28: 0x84DC;
    readonly TEXTURE29: 0x84DD;
    readonly TEXTURE30: 0x84DE;
    readonly TEXTURE31: 0x84DF;
    readonly ACTIVE_TEXTURE: 0x84E0;
    readonly REPEAT: 0x2901;
    readonly CLAMP_TO_EDGE: 0x812F;
    readonly MIRRORED_REPEAT: 0x8370;
    readonly FLOAT_VEC2: 0x8B50;
    readonly FLOAT_VEC3: 0x8B51;
    readonly FLOAT_VEC4: 0x8B52;
    readonly INT_VEC2: 0x8B53;
    readonly INT_VEC3: 0x8B54;
    readonly INT_VEC4: 0x8B55;
    readonly BOOL: 0x8B56;
    readonly BOOL_VEC2: 0x8B57;
    readonly BOOL_VEC3: 0x8B58;
    readonly BOOL_VEC4: 0x8B59;
    readonly FLOAT_MAT2: 0x8B5A;
    readonly FLOAT_MAT3: 0x8B5B;
    readonly FLOAT_MAT4: 0x8B5C;
    readonly SAMPLER_2D: 0x8B5E;
    readonly SAMPLER_CUBE: 0x8B60;
    readonly VERTEX_ATTRIB_ARRAY_ENABLED: 0x8622;
    readonly VERTEX_ATTRIB_ARRAY_SIZE: 0x8623;
    readonly VERTEX_ATTRIB_ARRAY_STRIDE: 0x8624;
    readonly VERTEX_ATTRIB_ARRAY_TYPE: 0x8625;
    readonly VERTEX_ATTRIB_ARRAY_NORMALIZED: 0x886A;
    readonly VERTEX_ATTRIB_ARRAY_POINTER: 0x8645;
    readonly VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 0x889F;
    readonly IMPLEMENTATION_COLOR_READ_TYPE: 0x8B9A;
    readonly IMPLEMENTATION_COLOR_READ_FORMAT: 0x8B9B;
    readonly COMPILE_STATUS: 0x8B81;
    readonly LOW_FLOAT: 0x8DF0;
    readonly MEDIUM_FLOAT: 0x8DF1;
    readonly HIGH_FLOAT: 0x8DF2;
    readonly LOW_INT: 0x8DF3;
    readonly MEDIUM_INT: 0x8DF4;
    readonly HIGH_INT: 0x8DF5;
    readonly FRAMEBUFFER: 0x8D40;
    readonly RENDERBUFFER: 0x8D41;
    readonly RGBA4: 0x8056;
    readonly RGB5_A1: 0x8057;
    readonly RGBA8: 0x8058;
    readonly RGB565: 0x8D62;
    readonly DEPTH_COMPONENT16: 0x81A5;
    readonly STENCIL_INDEX8: 0x8D48;
    readonly DEPTH_STENCIL: 0x84F9;
    readonly RENDERBUFFER_WIDTH: 0x8D42;
    readonly RENDERBUFFER_HEIGHT: 0x8D43;
    readonly RENDERBUFFER_INTERNAL_FORMAT: 0x8D44;
    readonly RENDERBUFFER_RED_SIZE: 0x8D50;
    readonly RENDERBUFFER_GREEN_SIZE: 0x8D51;
    readonly RENDERBUFFER_BLUE_SIZE: 0x8D52;
    readonly RENDERBUFFER_ALPHA_SIZE: 0x8D53;
    readonly RENDERBUFFER_DEPTH_SIZE: 0x8D54;
    readonly RENDERBUFFER_STENCIL_SIZE: 0x8D55;
    readonly FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 0x8CD0;
    readonly FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 0x8CD1;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 0x8CD2;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 0x8CD3;
    readonly COLOR_ATTACHMENT0: 0x8CE0;
    readonly DEPTH_ATTACHMENT: 0x8D00;
    readonly STENCIL_ATTACHMENT: 0x8D20;
    readonly DEPTH_STENCIL_ATTACHMENT: 0x821A;
    readonly NONE: 0;
    readonly FRAMEBUFFER_COMPLETE: 0x8CD5;
    readonly FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 0x8CD6;
    readonly FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 0x8CD7;
    readonly FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 0x8CD9;
    readonly FRAMEBUFFER_UNSUPPORTED: 0x8CDD;
    readonly FRAMEBUFFER_BINDING: 0x8CA6;
    readonly RENDERBUFFER_BINDING: 0x8CA7;
    readonly MAX_RENDERBUFFER_SIZE: 0x84E8;
    readonly INVALID_FRAMEBUFFER_OPERATION: 0x0506;
    readonly UNPACK_FLIP_Y_WEBGL: 0x9240;
    readonly UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241;
    readonly CONTEXT_LOST_WEBGL: 0x9242;
    readonly UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243;
    readonly BROWSER_DEFAULT_WEBGL: 0x9244;
};

interface WebGLRenderingContextBase {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/drawingBufferColorSpace) */
    drawingBufferColorSpace: PredefinedColorSpace;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/drawingBufferHeight) */
    readonly drawingBufferHeight: GLsizei;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/drawingBufferWidth) */
    readonly drawingBufferWidth: GLsizei;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGL2RenderingContext/unpackColorSpace) */
    unpackColorSpace: PredefinedColorSpace;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/activeTexture) */
    activeTexture(texture: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/attachShader) */
    attachShader(program: WebGLProgram, shader: WebGLShader): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bindAttribLocation) */
    bindAttribLocation(program: WebGLProgram, index: GLuint, name: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bindBuffer) */
    bindBuffer(target: GLenum, buffer: WebGLBuffer | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bindFramebuffer) */
    bindFramebuffer(target: GLenum, framebuffer: WebGLFramebuffer | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bindRenderbuffer) */
    bindRenderbuffer(target: GLenum, renderbuffer: WebGLRenderbuffer | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bindTexture) */
    bindTexture(target: GLenum, texture: WebGLTexture | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/blendColor) */
    blendColor(red: GLclampf, green: GLclampf, blue: GLclampf, alpha: GLclampf): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/blendEquation) */
    blendEquation(mode: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/blendEquationSeparate) */
    blendEquationSeparate(modeRGB: GLenum, modeAlpha: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/blendFunc) */
    blendFunc(sfactor: GLenum, dfactor: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/blendFuncSeparate) */
    blendFuncSeparate(srcRGB: GLenum, dstRGB: GLenum, srcAlpha: GLenum, dstAlpha: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/checkFramebufferStatus) */
    checkFramebufferStatus(target: GLenum): GLenum;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/clear) */
    clear(mask: GLbitfield): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/clearColor) */
    clearColor(red: GLclampf, green: GLclampf, blue: GLclampf, alpha: GLclampf): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/clearDepth) */
    clearDepth(depth: GLclampf): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/clearStencil) */
    clearStencil(s: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/colorMask) */
    colorMask(red: GLboolean, green: GLboolean, blue: GLboolean, alpha: GLboolean): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/compileShader) */
    compileShader(shader: WebGLShader): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/copyTexImage2D) */
    copyTexImage2D(target: GLenum, level: GLint, internalformat: GLenum, x: GLint, y: GLint, width: GLsizei, height: GLsizei, border: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/copyTexSubImage2D) */
    copyTexSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, x: GLint, y: GLint, width: GLsizei, height: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/createBuffer) */
    createBuffer(): WebGLBuffer;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/createFramebuffer) */
    createFramebuffer(): WebGLFramebuffer;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/createProgram) */
    createProgram(): WebGLProgram;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/createRenderbuffer) */
    createRenderbuffer(): WebGLRenderbuffer;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/createShader) */
    createShader(type: GLenum): WebGLShader | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/createTexture) */
    createTexture(): WebGLTexture;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/cullFace) */
    cullFace(mode: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/deleteBuffer) */
    deleteBuffer(buffer: WebGLBuffer | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/deleteFramebuffer) */
    deleteFramebuffer(framebuffer: WebGLFramebuffer | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/deleteProgram) */
    deleteProgram(program: WebGLProgram | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/deleteRenderbuffer) */
    deleteRenderbuffer(renderbuffer: WebGLRenderbuffer | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/deleteShader) */
    deleteShader(shader: WebGLShader | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/deleteTexture) */
    deleteTexture(texture: WebGLTexture | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/depthFunc) */
    depthFunc(func: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/depthMask) */
    depthMask(flag: GLboolean): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/depthRange) */
    depthRange(zNear: GLclampf, zFar: GLclampf): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/detachShader) */
    detachShader(program: WebGLProgram, shader: WebGLShader): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/disable) */
    disable(cap: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/disableVertexAttribArray) */
    disableVertexAttribArray(index: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/drawArrays) */
    drawArrays(mode: GLenum, first: GLint, count: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/drawElements) */
    drawElements(mode: GLenum, count: GLsizei, type: GLenum, offset: GLintptr): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/enable) */
    enable(cap: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/enableVertexAttribArray) */
    enableVertexAttribArray(index: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/finish) */
    finish(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/flush) */
    flush(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/framebufferRenderbuffer) */
    framebufferRenderbuffer(target: GLenum, attachment: GLenum, renderbuffertarget: GLenum, renderbuffer: WebGLRenderbuffer | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/framebufferTexture2D) */
    framebufferTexture2D(target: GLenum, attachment: GLenum, textarget: GLenum, texture: WebGLTexture | null, level: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/frontFace) */
    frontFace(mode: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/generateMipmap) */
    generateMipmap(target: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getActiveAttrib) */
    getActiveAttrib(program: WebGLProgram, index: GLuint): WebGLActiveInfo | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getActiveUniform) */
    getActiveUniform(program: WebGLProgram, index: GLuint): WebGLActiveInfo | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getAttachedShaders) */
    getAttachedShaders(program: WebGLProgram): WebGLShader[] | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getAttribLocation) */
    getAttribLocation(program: WebGLProgram, name: string): GLint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getBufferParameter) */
    getBufferParameter(target: GLenum, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getContextAttributes) */
    getContextAttributes(): WebGLContextAttributes | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getError) */
    getError(): GLenum;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getExtension) */
    getExtension(extensionName: "ANGLE_instanced_arrays"): ANGLE_instanced_arrays | null;
    getExtension(extensionName: "EXT_blend_minmax"): EXT_blend_minmax | null;
    getExtension(extensionName: "EXT_color_buffer_float"): EXT_color_buffer_float | null;
    getExtension(extensionName: "EXT_color_buffer_half_float"): EXT_color_buffer_half_float | null;
    getExtension(extensionName: "EXT_float_blend"): EXT_float_blend | null;
    getExtension(extensionName: "EXT_frag_depth"): EXT_frag_depth | null;
    getExtension(extensionName: "EXT_sRGB"): EXT_sRGB | null;
    getExtension(extensionName: "EXT_shader_texture_lod"): EXT_shader_texture_lod | null;
    getExtension(extensionName: "EXT_texture_compression_bptc"): EXT_texture_compression_bptc | null;
    getExtension(extensionName: "EXT_texture_compression_rgtc"): EXT_texture_compression_rgtc | null;
    getExtension(extensionName: "EXT_texture_filter_anisotropic"): EXT_texture_filter_anisotropic | null;
    getExtension(extensionName: "KHR_parallel_shader_compile"): KHR_parallel_shader_compile | null;
    getExtension(extensionName: "OES_element_index_uint"): OES_element_index_uint | null;
    getExtension(extensionName: "OES_fbo_render_mipmap"): OES_fbo_render_mipmap | null;
    getExtension(extensionName: "OES_standard_derivatives"): OES_standard_derivatives | null;
    getExtension(extensionName: "OES_texture_float"): OES_texture_float | null;
    getExtension(extensionName: "OES_texture_float_linear"): OES_texture_float_linear | null;
    getExtension(extensionName: "OES_texture_half_float"): OES_texture_half_float | null;
    getExtension(extensionName: "OES_texture_half_float_linear"): OES_texture_half_float_linear | null;
    getExtension(extensionName: "OES_vertex_array_object"): OES_vertex_array_object | null;
    getExtension(extensionName: "OVR_multiview2"): OVR_multiview2 | null;
    getExtension(extensionName: "WEBGL_color_buffer_float"): WEBGL_color_buffer_float | null;
    getExtension(extensionName: "WEBGL_compressed_texture_astc"): WEBGL_compressed_texture_astc | null;
    getExtension(extensionName: "WEBGL_compressed_texture_etc"): WEBGL_compressed_texture_etc | null;
    getExtension(extensionName: "WEBGL_compressed_texture_etc1"): WEBGL_compressed_texture_etc1 | null;
    getExtension(extensionName: "WEBGL_compressed_texture_pvrtc"): WEBGL_compressed_texture_pvrtc | null;
    getExtension(extensionName: "WEBGL_compressed_texture_s3tc"): WEBGL_compressed_texture_s3tc | null;
    getExtension(extensionName: "WEBGL_compressed_texture_s3tc_srgb"): WEBGL_compressed_texture_s3tc_srgb | null;
    getExtension(extensionName: "WEBGL_debug_renderer_info"): WEBGL_debug_renderer_info | null;
    getExtension(extensionName: "WEBGL_debug_shaders"): WEBGL_debug_shaders | null;
    getExtension(extensionName: "WEBGL_depth_texture"): WEBGL_depth_texture | null;
    getExtension(extensionName: "WEBGL_draw_buffers"): WEBGL_draw_buffers | null;
    getExtension(extensionName: "WEBGL_lose_context"): WEBGL_lose_context | null;
    getExtension(extensionName: "WEBGL_multi_draw"): WEBGL_multi_draw | null;
    getExtension(name: string): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getFramebufferAttachmentParameter) */
    getFramebufferAttachmentParameter(target: GLenum, attachment: GLenum, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getParameter) */
    getParameter(pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getProgramInfoLog) */
    getProgramInfoLog(program: WebGLProgram): string | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getProgramParameter) */
    getProgramParameter(program: WebGLProgram, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getRenderbufferParameter) */
    getRenderbufferParameter(target: GLenum, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getShaderInfoLog) */
    getShaderInfoLog(shader: WebGLShader): string | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getShaderParameter) */
    getShaderParameter(shader: WebGLShader, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getShaderPrecisionFormat) */
    getShaderPrecisionFormat(shadertype: GLenum, precisiontype: GLenum): WebGLShaderPrecisionFormat | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getShaderSource) */
    getShaderSource(shader: WebGLShader): string | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getSupportedExtensions) */
    getSupportedExtensions(): string[] | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getTexParameter) */
    getTexParameter(target: GLenum, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getUniform) */
    getUniform(program: WebGLProgram, location: WebGLUniformLocation): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getUniformLocation) */
    getUniformLocation(program: WebGLProgram, name: string): WebGLUniformLocation | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getVertexAttrib) */
    getVertexAttrib(index: GLuint, pname: GLenum): any;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/getVertexAttribOffset) */
    getVertexAttribOffset(index: GLuint, pname: GLenum): GLintptr;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/hint) */
    hint(target: GLenum, mode: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/isBuffer) */
    isBuffer(buffer: WebGLBuffer | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/isContextLost) */
    isContextLost(): boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/isEnabled) */
    isEnabled(cap: GLenum): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/isFramebuffer) */
    isFramebuffer(framebuffer: WebGLFramebuffer | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/isProgram) */
    isProgram(program: WebGLProgram | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/isRenderbuffer) */
    isRenderbuffer(renderbuffer: WebGLRenderbuffer | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/isShader) */
    isShader(shader: WebGLShader | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/isTexture) */
    isTexture(texture: WebGLTexture | null): GLboolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/lineWidth) */
    lineWidth(width: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/linkProgram) */
    linkProgram(program: WebGLProgram): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/pixelStorei) */
    pixelStorei(pname: GLenum, param: GLint | GLboolean): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/polygonOffset) */
    polygonOffset(factor: GLfloat, units: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/renderbufferStorage) */
    renderbufferStorage(target: GLenum, internalformat: GLenum, width: GLsizei, height: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/sampleCoverage) */
    sampleCoverage(value: GLclampf, invert: GLboolean): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/scissor) */
    scissor(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/shaderSource) */
    shaderSource(shader: WebGLShader, source: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/stencilFunc) */
    stencilFunc(func: GLenum, ref: GLint, mask: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/stencilFuncSeparate) */
    stencilFuncSeparate(face: GLenum, func: GLenum, ref: GLint, mask: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/stencilMask) */
    stencilMask(mask: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/stencilMaskSeparate) */
    stencilMaskSeparate(face: GLenum, mask: GLuint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/stencilOp) */
    stencilOp(fail: GLenum, zfail: GLenum, zpass: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/stencilOpSeparate) */
    stencilOpSeparate(face: GLenum, fail: GLenum, zfail: GLenum, zpass: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/texParameter) */
    texParameterf(target: GLenum, pname: GLenum, param: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/texParameter) */
    texParameteri(target: GLenum, pname: GLenum, param: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform1f(location: WebGLUniformLocation | null, x: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform1i(location: WebGLUniformLocation | null, x: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform2f(location: WebGLUniformLocation | null, x: GLfloat, y: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform2i(location: WebGLUniformLocation | null, x: GLint, y: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform3f(location: WebGLUniformLocation | null, x: GLfloat, y: GLfloat, z: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform3i(location: WebGLUniformLocation | null, x: GLint, y: GLint, z: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform4f(location: WebGLUniformLocation | null, x: GLfloat, y: GLfloat, z: GLfloat, w: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform4i(location: WebGLUniformLocation | null, x: GLint, y: GLint, z: GLint, w: GLint): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/useProgram) */
    useProgram(program: WebGLProgram | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/validateProgram) */
    validateProgram(program: WebGLProgram): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttrib) */
    vertexAttrib1f(index: GLuint, x: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttrib) */
    vertexAttrib1fv(index: GLuint, values: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttrib) */
    vertexAttrib2f(index: GLuint, x: GLfloat, y: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttrib) */
    vertexAttrib2fv(index: GLuint, values: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttrib) */
    vertexAttrib3f(index: GLuint, x: GLfloat, y: GLfloat, z: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttrib) */
    vertexAttrib3fv(index: GLuint, values: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttrib) */
    vertexAttrib4f(index: GLuint, x: GLfloat, y: GLfloat, z: GLfloat, w: GLfloat): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttrib) */
    vertexAttrib4fv(index: GLuint, values: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/vertexAttribPointer) */
    vertexAttribPointer(index: GLuint, size: GLint, type: GLenum, normalized: GLboolean, stride: GLsizei, offset: GLintptr): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/viewport) */
    viewport(x: GLint, y: GLint, width: GLsizei, height: GLsizei): void;
    readonly DEPTH_BUFFER_BIT: 0x00000100;
    readonly STENCIL_BUFFER_BIT: 0x00000400;
    readonly COLOR_BUFFER_BIT: 0x00004000;
    readonly POINTS: 0x0000;
    readonly LINES: 0x0001;
    readonly LINE_LOOP: 0x0002;
    readonly LINE_STRIP: 0x0003;
    readonly TRIANGLES: 0x0004;
    readonly TRIANGLE_STRIP: 0x0005;
    readonly TRIANGLE_FAN: 0x0006;
    readonly ZERO: 0;
    readonly ONE: 1;
    readonly SRC_COLOR: 0x0300;
    readonly ONE_MINUS_SRC_COLOR: 0x0301;
    readonly SRC_ALPHA: 0x0302;
    readonly ONE_MINUS_SRC_ALPHA: 0x0303;
    readonly DST_ALPHA: 0x0304;
    readonly ONE_MINUS_DST_ALPHA: 0x0305;
    readonly DST_COLOR: 0x0306;
    readonly ONE_MINUS_DST_COLOR: 0x0307;
    readonly SRC_ALPHA_SATURATE: 0x0308;
    readonly FUNC_ADD: 0x8006;
    readonly BLEND_EQUATION: 0x8009;
    readonly BLEND_EQUATION_RGB: 0x8009;
    readonly BLEND_EQUATION_ALPHA: 0x883D;
    readonly FUNC_SUBTRACT: 0x800A;
    readonly FUNC_REVERSE_SUBTRACT: 0x800B;
    readonly BLEND_DST_RGB: 0x80C8;
    readonly BLEND_SRC_RGB: 0x80C9;
    readonly BLEND_DST_ALPHA: 0x80CA;
    readonly BLEND_SRC_ALPHA: 0x80CB;
    readonly CONSTANT_COLOR: 0x8001;
    readonly ONE_MINUS_CONSTANT_COLOR: 0x8002;
    readonly CONSTANT_ALPHA: 0x8003;
    readonly ONE_MINUS_CONSTANT_ALPHA: 0x8004;
    readonly BLEND_COLOR: 0x8005;
    readonly ARRAY_BUFFER: 0x8892;
    readonly ELEMENT_ARRAY_BUFFER: 0x8893;
    readonly ARRAY_BUFFER_BINDING: 0x8894;
    readonly ELEMENT_ARRAY_BUFFER_BINDING: 0x8895;
    readonly STREAM_DRAW: 0x88E0;
    readonly STATIC_DRAW: 0x88E4;
    readonly DYNAMIC_DRAW: 0x88E8;
    readonly BUFFER_SIZE: 0x8764;
    readonly BUFFER_USAGE: 0x8765;
    readonly CURRENT_VERTEX_ATTRIB: 0x8626;
    readonly FRONT: 0x0404;
    readonly BACK: 0x0405;
    readonly FRONT_AND_BACK: 0x0408;
    readonly CULL_FACE: 0x0B44;
    readonly BLEND: 0x0BE2;
    readonly DITHER: 0x0BD0;
    readonly STENCIL_TEST: 0x0B90;
    readonly DEPTH_TEST: 0x0B71;
    readonly SCISSOR_TEST: 0x0C11;
    readonly POLYGON_OFFSET_FILL: 0x8037;
    readonly SAMPLE_ALPHA_TO_COVERAGE: 0x809E;
    readonly SAMPLE_COVERAGE: 0x80A0;
    readonly NO_ERROR: 0;
    readonly INVALID_ENUM: 0x0500;
    readonly INVALID_VALUE: 0x0501;
    readonly INVALID_OPERATION: 0x0502;
    readonly OUT_OF_MEMORY: 0x0505;
    readonly CW: 0x0900;
    readonly CCW: 0x0901;
    readonly LINE_WIDTH: 0x0B21;
    readonly ALIASED_POINT_SIZE_RANGE: 0x846D;
    readonly ALIASED_LINE_WIDTH_RANGE: 0x846E;
    readonly CULL_FACE_MODE: 0x0B45;
    readonly FRONT_FACE: 0x0B46;
    readonly DEPTH_RANGE: 0x0B70;
    readonly DEPTH_WRITEMASK: 0x0B72;
    readonly DEPTH_CLEAR_VALUE: 0x0B73;
    readonly DEPTH_FUNC: 0x0B74;
    readonly STENCIL_CLEAR_VALUE: 0x0B91;
    readonly STENCIL_FUNC: 0x0B92;
    readonly STENCIL_FAIL: 0x0B94;
    readonly STENCIL_PASS_DEPTH_FAIL: 0x0B95;
    readonly STENCIL_PASS_DEPTH_PASS: 0x0B96;
    readonly STENCIL_REF: 0x0B97;
    readonly STENCIL_VALUE_MASK: 0x0B93;
    readonly STENCIL_WRITEMASK: 0x0B98;
    readonly STENCIL_BACK_FUNC: 0x8800;
    readonly STENCIL_BACK_FAIL: 0x8801;
    readonly STENCIL_BACK_PASS_DEPTH_FAIL: 0x8802;
    readonly STENCIL_BACK_PASS_DEPTH_PASS: 0x8803;
    readonly STENCIL_BACK_REF: 0x8CA3;
    readonly STENCIL_BACK_VALUE_MASK: 0x8CA4;
    readonly STENCIL_BACK_WRITEMASK: 0x8CA5;
    readonly VIEWPORT: 0x0BA2;
    readonly SCISSOR_BOX: 0x0C10;
    readonly COLOR_CLEAR_VALUE: 0x0C22;
    readonly COLOR_WRITEMASK: 0x0C23;
    readonly UNPACK_ALIGNMENT: 0x0CF5;
    readonly PACK_ALIGNMENT: 0x0D05;
    readonly MAX_TEXTURE_SIZE: 0x0D33;
    readonly MAX_VIEWPORT_DIMS: 0x0D3A;
    readonly SUBPIXEL_BITS: 0x0D50;
    readonly RED_BITS: 0x0D52;
    readonly GREEN_BITS: 0x0D53;
    readonly BLUE_BITS: 0x0D54;
    readonly ALPHA_BITS: 0x0D55;
    readonly DEPTH_BITS: 0x0D56;
    readonly STENCIL_BITS: 0x0D57;
    readonly POLYGON_OFFSET_UNITS: 0x2A00;
    readonly POLYGON_OFFSET_FACTOR: 0x8038;
    readonly TEXTURE_BINDING_2D: 0x8069;
    readonly SAMPLE_BUFFERS: 0x80A8;
    readonly SAMPLES: 0x80A9;
    readonly SAMPLE_COVERAGE_VALUE: 0x80AA;
    readonly SAMPLE_COVERAGE_INVERT: 0x80AB;
    readonly COMPRESSED_TEXTURE_FORMATS: 0x86A3;
    readonly DONT_CARE: 0x1100;
    readonly FASTEST: 0x1101;
    readonly NICEST: 0x1102;
    readonly GENERATE_MIPMAP_HINT: 0x8192;
    readonly BYTE: 0x1400;
    readonly UNSIGNED_BYTE: 0x1401;
    readonly SHORT: 0x1402;
    readonly UNSIGNED_SHORT: 0x1403;
    readonly INT: 0x1404;
    readonly UNSIGNED_INT: 0x1405;
    readonly FLOAT: 0x1406;
    readonly DEPTH_COMPONENT: 0x1902;
    readonly ALPHA: 0x1906;
    readonly RGB: 0x1907;
    readonly RGBA: 0x1908;
    readonly LUMINANCE: 0x1909;
    readonly LUMINANCE_ALPHA: 0x190A;
    readonly UNSIGNED_SHORT_4_4_4_4: 0x8033;
    readonly UNSIGNED_SHORT_5_5_5_1: 0x8034;
    readonly UNSIGNED_SHORT_5_6_5: 0x8363;
    readonly FRAGMENT_SHADER: 0x8B30;
    readonly VERTEX_SHADER: 0x8B31;
    readonly MAX_VERTEX_ATTRIBS: 0x8869;
    readonly MAX_VERTEX_UNIFORM_VECTORS: 0x8DFB;
    readonly MAX_VARYING_VECTORS: 0x8DFC;
    readonly MAX_COMBINED_TEXTURE_IMAGE_UNITS: 0x8B4D;
    readonly MAX_VERTEX_TEXTURE_IMAGE_UNITS: 0x8B4C;
    readonly MAX_TEXTURE_IMAGE_UNITS: 0x8872;
    readonly MAX_FRAGMENT_UNIFORM_VECTORS: 0x8DFD;
    readonly SHADER_TYPE: 0x8B4F;
    readonly DELETE_STATUS: 0x8B80;
    readonly LINK_STATUS: 0x8B82;
    readonly VALIDATE_STATUS: 0x8B83;
    readonly ATTACHED_SHADERS: 0x8B85;
    readonly ACTIVE_UNIFORMS: 0x8B86;
    readonly ACTIVE_ATTRIBUTES: 0x8B89;
    readonly SHADING_LANGUAGE_VERSION: 0x8B8C;
    readonly CURRENT_PROGRAM: 0x8B8D;
    readonly NEVER: 0x0200;
    readonly LESS: 0x0201;
    readonly EQUAL: 0x0202;
    readonly LEQUAL: 0x0203;
    readonly GREATER: 0x0204;
    readonly NOTEQUAL: 0x0205;
    readonly GEQUAL: 0x0206;
    readonly ALWAYS: 0x0207;
    readonly KEEP: 0x1E00;
    readonly REPLACE: 0x1E01;
    readonly INCR: 0x1E02;
    readonly DECR: 0x1E03;
    readonly INVERT: 0x150A;
    readonly INCR_WRAP: 0x8507;
    readonly DECR_WRAP: 0x8508;
    readonly VENDOR: 0x1F00;
    readonly RENDERER: 0x1F01;
    readonly VERSION: 0x1F02;
    readonly NEAREST: 0x2600;
    readonly LINEAR: 0x2601;
    readonly NEAREST_MIPMAP_NEAREST: 0x2700;
    readonly LINEAR_MIPMAP_NEAREST: 0x2701;
    readonly NEAREST_MIPMAP_LINEAR: 0x2702;
    readonly LINEAR_MIPMAP_LINEAR: 0x2703;
    readonly TEXTURE_MAG_FILTER: 0x2800;
    readonly TEXTURE_MIN_FILTER: 0x2801;
    readonly TEXTURE_WRAP_S: 0x2802;
    readonly TEXTURE_WRAP_T: 0x2803;
    readonly TEXTURE_2D: 0x0DE1;
    readonly TEXTURE: 0x1702;
    readonly TEXTURE_CUBE_MAP: 0x8513;
    readonly TEXTURE_BINDING_CUBE_MAP: 0x8514;
    readonly TEXTURE_CUBE_MAP_POSITIVE_X: 0x8515;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_X: 0x8516;
    readonly TEXTURE_CUBE_MAP_POSITIVE_Y: 0x8517;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_Y: 0x8518;
    readonly TEXTURE_CUBE_MAP_POSITIVE_Z: 0x8519;
    readonly TEXTURE_CUBE_MAP_NEGATIVE_Z: 0x851A;
    readonly MAX_CUBE_MAP_TEXTURE_SIZE: 0x851C;
    readonly TEXTURE0: 0x84C0;
    readonly TEXTURE1: 0x84C1;
    readonly TEXTURE2: 0x84C2;
    readonly TEXTURE3: 0x84C3;
    readonly TEXTURE4: 0x84C4;
    readonly TEXTURE5: 0x84C5;
    readonly TEXTURE6: 0x84C6;
    readonly TEXTURE7: 0x84C7;
    readonly TEXTURE8: 0x84C8;
    readonly TEXTURE9: 0x84C9;
    readonly TEXTURE10: 0x84CA;
    readonly TEXTURE11: 0x84CB;
    readonly TEXTURE12: 0x84CC;
    readonly TEXTURE13: 0x84CD;
    readonly TEXTURE14: 0x84CE;
    readonly TEXTURE15: 0x84CF;
    readonly TEXTURE16: 0x84D0;
    readonly TEXTURE17: 0x84D1;
    readonly TEXTURE18: 0x84D2;
    readonly TEXTURE19: 0x84D3;
    readonly TEXTURE20: 0x84D4;
    readonly TEXTURE21: 0x84D5;
    readonly TEXTURE22: 0x84D6;
    readonly TEXTURE23: 0x84D7;
    readonly TEXTURE24: 0x84D8;
    readonly TEXTURE25: 0x84D9;
    readonly TEXTURE26: 0x84DA;
    readonly TEXTURE27: 0x84DB;
    readonly TEXTURE28: 0x84DC;
    readonly TEXTURE29: 0x84DD;
    readonly TEXTURE30: 0x84DE;
    readonly TEXTURE31: 0x84DF;
    readonly ACTIVE_TEXTURE: 0x84E0;
    readonly REPEAT: 0x2901;
    readonly CLAMP_TO_EDGE: 0x812F;
    readonly MIRRORED_REPEAT: 0x8370;
    readonly FLOAT_VEC2: 0x8B50;
    readonly FLOAT_VEC3: 0x8B51;
    readonly FLOAT_VEC4: 0x8B52;
    readonly INT_VEC2: 0x8B53;
    readonly INT_VEC3: 0x8B54;
    readonly INT_VEC4: 0x8B55;
    readonly BOOL: 0x8B56;
    readonly BOOL_VEC2: 0x8B57;
    readonly BOOL_VEC3: 0x8B58;
    readonly BOOL_VEC4: 0x8B59;
    readonly FLOAT_MAT2: 0x8B5A;
    readonly FLOAT_MAT3: 0x8B5B;
    readonly FLOAT_MAT4: 0x8B5C;
    readonly SAMPLER_2D: 0x8B5E;
    readonly SAMPLER_CUBE: 0x8B60;
    readonly VERTEX_ATTRIB_ARRAY_ENABLED: 0x8622;
    readonly VERTEX_ATTRIB_ARRAY_SIZE: 0x8623;
    readonly VERTEX_ATTRIB_ARRAY_STRIDE: 0x8624;
    readonly VERTEX_ATTRIB_ARRAY_TYPE: 0x8625;
    readonly VERTEX_ATTRIB_ARRAY_NORMALIZED: 0x886A;
    readonly VERTEX_ATTRIB_ARRAY_POINTER: 0x8645;
    readonly VERTEX_ATTRIB_ARRAY_BUFFER_BINDING: 0x889F;
    readonly IMPLEMENTATION_COLOR_READ_TYPE: 0x8B9A;
    readonly IMPLEMENTATION_COLOR_READ_FORMAT: 0x8B9B;
    readonly COMPILE_STATUS: 0x8B81;
    readonly LOW_FLOAT: 0x8DF0;
    readonly MEDIUM_FLOAT: 0x8DF1;
    readonly HIGH_FLOAT: 0x8DF2;
    readonly LOW_INT: 0x8DF3;
    readonly MEDIUM_INT: 0x8DF4;
    readonly HIGH_INT: 0x8DF5;
    readonly FRAMEBUFFER: 0x8D40;
    readonly RENDERBUFFER: 0x8D41;
    readonly RGBA4: 0x8056;
    readonly RGB5_A1: 0x8057;
    readonly RGBA8: 0x8058;
    readonly RGB565: 0x8D62;
    readonly DEPTH_COMPONENT16: 0x81A5;
    readonly STENCIL_INDEX8: 0x8D48;
    readonly DEPTH_STENCIL: 0x84F9;
    readonly RENDERBUFFER_WIDTH: 0x8D42;
    readonly RENDERBUFFER_HEIGHT: 0x8D43;
    readonly RENDERBUFFER_INTERNAL_FORMAT: 0x8D44;
    readonly RENDERBUFFER_RED_SIZE: 0x8D50;
    readonly RENDERBUFFER_GREEN_SIZE: 0x8D51;
    readonly RENDERBUFFER_BLUE_SIZE: 0x8D52;
    readonly RENDERBUFFER_ALPHA_SIZE: 0x8D53;
    readonly RENDERBUFFER_DEPTH_SIZE: 0x8D54;
    readonly RENDERBUFFER_STENCIL_SIZE: 0x8D55;
    readonly FRAMEBUFFER_ATTACHMENT_OBJECT_TYPE: 0x8CD0;
    readonly FRAMEBUFFER_ATTACHMENT_OBJECT_NAME: 0x8CD1;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_LEVEL: 0x8CD2;
    readonly FRAMEBUFFER_ATTACHMENT_TEXTURE_CUBE_MAP_FACE: 0x8CD3;
    readonly COLOR_ATTACHMENT0: 0x8CE0;
    readonly DEPTH_ATTACHMENT: 0x8D00;
    readonly STENCIL_ATTACHMENT: 0x8D20;
    readonly DEPTH_STENCIL_ATTACHMENT: 0x821A;
    readonly NONE: 0;
    readonly FRAMEBUFFER_COMPLETE: 0x8CD5;
    readonly FRAMEBUFFER_INCOMPLETE_ATTACHMENT: 0x8CD6;
    readonly FRAMEBUFFER_INCOMPLETE_MISSING_ATTACHMENT: 0x8CD7;
    readonly FRAMEBUFFER_INCOMPLETE_DIMENSIONS: 0x8CD9;
    readonly FRAMEBUFFER_UNSUPPORTED: 0x8CDD;
    readonly FRAMEBUFFER_BINDING: 0x8CA6;
    readonly RENDERBUFFER_BINDING: 0x8CA7;
    readonly MAX_RENDERBUFFER_SIZE: 0x84E8;
    readonly INVALID_FRAMEBUFFER_OPERATION: 0x0506;
    readonly UNPACK_FLIP_Y_WEBGL: 0x9240;
    readonly UNPACK_PREMULTIPLY_ALPHA_WEBGL: 0x9241;
    readonly CONTEXT_LOST_WEBGL: 0x9242;
    readonly UNPACK_COLORSPACE_CONVERSION_WEBGL: 0x9243;
    readonly BROWSER_DEFAULT_WEBGL: 0x9244;
}

interface WebGLRenderingContextOverloads {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bufferData) */
    bufferData(target: GLenum, size: GLsizeiptr, usage: GLenum): void;
    bufferData(target: GLenum, data: AllowSharedBufferSource | null, usage: GLenum): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/bufferSubData) */
    bufferSubData(target: GLenum, offset: GLintptr, data: AllowSharedBufferSource): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/compressedTexImage2D) */
    compressedTexImage2D(target: GLenum, level: GLint, internalformat: GLenum, width: GLsizei, height: GLsizei, border: GLint, data: ArrayBufferView): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/compressedTexSubImage2D) */
    compressedTexSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, width: GLsizei, height: GLsizei, format: GLenum, data: ArrayBufferView): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/readPixels) */
    readPixels(x: GLint, y: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, pixels: ArrayBufferView | null): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/texImage2D) */
    texImage2D(target: GLenum, level: GLint, internalformat: GLint, width: GLsizei, height: GLsizei, border: GLint, format: GLenum, type: GLenum, pixels: ArrayBufferView | null): void;
    texImage2D(target: GLenum, level: GLint, internalformat: GLint, format: GLenum, type: GLenum, source: TexImageSource): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/texSubImage2D) */
    texSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, width: GLsizei, height: GLsizei, format: GLenum, type: GLenum, pixels: ArrayBufferView | null): void;
    texSubImage2D(target: GLenum, level: GLint, xoffset: GLint, yoffset: GLint, format: GLenum, type: GLenum, source: TexImageSource): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform1fv(location: WebGLUniformLocation | null, v: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform1iv(location: WebGLUniformLocation | null, v: Int32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform2fv(location: WebGLUniformLocation | null, v: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform2iv(location: WebGLUniformLocation | null, v: Int32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform3fv(location: WebGLUniformLocation | null, v: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform3iv(location: WebGLUniformLocation | null, v: Int32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform4fv(location: WebGLUniformLocation | null, v: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniform) */
    uniform4iv(location: WebGLUniformLocation | null, v: Int32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniformMatrix) */
    uniformMatrix2fv(location: WebGLUniformLocation | null, transpose: GLboolean, value: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniformMatrix) */
    uniformMatrix3fv(location: WebGLUniformLocation | null, transpose: GLboolean, value: Float32List): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLRenderingContext/uniformMatrix) */
    uniformMatrix4fv(location: WebGLUniformLocation | null, transpose: GLboolean, value: Float32List): void;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLSampler) */
interface WebGLSampler {
}

declare var WebGLSampler: {
    prototype: WebGLSampler;
    new(): WebGLSampler;
};

/**
 * The WebGLShader is part of the WebGL API and can either be a vertex or a fragment shader. A WebGLProgram requires both types of shaders.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLShader)
 */
interface WebGLShader {
}

declare var WebGLShader: {
    prototype: WebGLShader;
    new(): WebGLShader;
};

/**
 * Part of the WebGL API and represents the information returned by calling the WebGLRenderingContext.getShaderPrecisionFormat() method.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLShaderPrecisionFormat)
 */
interface WebGLShaderPrecisionFormat {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLShaderPrecisionFormat/precision) */
    readonly precision: GLint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLShaderPrecisionFormat/rangeMax) */
    readonly rangeMax: GLint;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLShaderPrecisionFormat/rangeMin) */
    readonly rangeMin: GLint;
}

declare var WebGLShaderPrecisionFormat: {
    prototype: WebGLShaderPrecisionFormat;
    new(): WebGLShaderPrecisionFormat;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLSync) */
interface WebGLSync {
}

declare var WebGLSync: {
    prototype: WebGLSync;
    new(): WebGLSync;
};

/**
 * Part of the WebGL API and represents an opaque texture object providing storage and state for texturing operations.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLTexture)
 */
interface WebGLTexture {
}

declare var WebGLTexture: {
    prototype: WebGLTexture;
    new(): WebGLTexture;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLTransformFeedback) */
interface WebGLTransformFeedback {
}

declare var WebGLTransformFeedback: {
    prototype: WebGLTransformFeedback;
    new(): WebGLTransformFeedback;
};

/**
 * Part of the WebGL API and represents the location of a uniform variable in a shader program.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLUniformLocation)
 */
interface WebGLUniformLocation {
}

declare var WebGLUniformLocation: {
    prototype: WebGLUniformLocation;
    new(): WebGLUniformLocation;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLVertexArrayObject) */
interface WebGLVertexArrayObject {
}

declare var WebGLVertexArrayObject: {
    prototype: WebGLVertexArrayObject;
    new(): WebGLVertexArrayObject;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebGLVertexArrayObject) */
interface WebGLVertexArrayObjectOES {
}

interface WebSocketEventMap {
    "close": CloseEvent;
    "error": Event;
    "message": MessageEvent;
    "open": Event;
}

/**
 * Provides the API for creating and managing a WebSocket connection to a server, as well as for sending and receiving data on the connection.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket)
 */
interface WebSocket extends EventTarget {
    /**
     * Returns a string that indicates how binary data from the WebSocket object is exposed to scripts:
     *
     * Can be set, to change how binary data is returned. The default is "blob".
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/binaryType)
     */
    binaryType: BinaryType;
    /**
     * Returns the number of bytes of application data (UTF-8 text and binary data) that have been queued using send() but not yet been transmitted to the network.
     *
     * If the WebSocket connection is closed, this attribute's value will only increase with each call to the send() method. (The number does not reset to zero once the connection closes.)
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/bufferedAmount)
     */
    readonly bufferedAmount: number;
    /**
     * Returns the extensions selected by the server, if any.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/extensions)
     */
    readonly extensions: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/close_event) */
    onclose: ((this: WebSocket, ev: CloseEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/error_event) */
    onerror: ((this: WebSocket, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/message_event) */
    onmessage: ((this: WebSocket, ev: MessageEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/open_event) */
    onopen: ((this: WebSocket, ev: Event) => any) | null;
    /**
     * Returns the subprotocol selected by the server, if any. It can be used in conjunction with the array form of the constructor's second argument to perform subprotocol negotiation.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/protocol)
     */
    readonly protocol: string;
    /**
     * Returns the state of the WebSocket object's connection. It can have the values described below.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/readyState)
     */
    readonly readyState: number;
    /**
     * Returns the URL that was used to establish the WebSocket connection.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/url)
     */
    readonly url: string;
    /**
     * Closes the WebSocket connection, optionally using code as the the WebSocket connection close code and reason as the the WebSocket connection close reason.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/close)
     */
    close(code?: number, reason?: string): void;
    /**
     * Transmits data using the WebSocket connection. data can be a string, a Blob, an ArrayBuffer, or an ArrayBufferView.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebSocket/send)
     */
    send(data: string | ArrayBufferLike | Blob | ArrayBufferView): void;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
    addEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof WebSocketEventMap>(type: K, listener: (this: WebSocket, ev: WebSocketEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var WebSocket: {
    prototype: WebSocket;
    new(url: string | URL, protocols?: string | string[]): WebSocket;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport)
 */
interface WebTransport {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport/closed) */
    readonly closed: Promise<WebTransportCloseInfo>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport/datagrams) */
    readonly datagrams: WebTransportDatagramDuplexStream;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport/incomingBidirectionalStreams) */
    readonly incomingBidirectionalStreams: ReadableStream;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport/incomingUnidirectionalStreams) */
    readonly incomingUnidirectionalStreams: ReadableStream;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport/ready) */
    readonly ready: Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport/close) */
    close(closeInfo?: WebTransportCloseInfo): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport/createBidirectionalStream) */
    createBidirectionalStream(options?: WebTransportSendStreamOptions): Promise<WebTransportBidirectionalStream>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransport/createUnidirectionalStream) */
    createUnidirectionalStream(options?: WebTransportSendStreamOptions): Promise<WritableStream>;
}

declare var WebTransport: {
    prototype: WebTransport;
    new(url: string | URL, options?: WebTransportOptions): WebTransport;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportBidirectionalStream)
 */
interface WebTransportBidirectionalStream {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportBidirectionalStream/readable) */
    readonly readable: ReadableStream;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportBidirectionalStream/writable) */
    readonly writable: WritableStream;
}

declare var WebTransportBidirectionalStream: {
    prototype: WebTransportBidirectionalStream;
    new(): WebTransportBidirectionalStream;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportDatagramDuplexStream)
 */
interface WebTransportDatagramDuplexStream {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportDatagramDuplexStream/incomingHighWaterMark) */
    incomingHighWaterMark: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportDatagramDuplexStream/incomingMaxAge) */
    incomingMaxAge: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportDatagramDuplexStream/maxDatagramSize) */
    readonly maxDatagramSize: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportDatagramDuplexStream/outgoingHighWaterMark) */
    outgoingHighWaterMark: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportDatagramDuplexStream/outgoingMaxAge) */
    outgoingMaxAge: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportDatagramDuplexStream/readable) */
    readonly readable: ReadableStream;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportDatagramDuplexStream/writable) */
    readonly writable: WritableStream;
}

declare var WebTransportDatagramDuplexStream: {
    prototype: WebTransportDatagramDuplexStream;
    new(): WebTransportDatagramDuplexStream;
};

/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportError)
 */
interface WebTransportError extends DOMException {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportError/source) */
    readonly source: WebTransportErrorSource;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WebTransportError/streamErrorCode) */
    readonly streamErrorCode: number | null;
}

declare var WebTransportError: {
    prototype: WebTransportError;
    new(message?: string, options?: WebTransportErrorOptions): WebTransportError;
};

/**
 * This ServiceWorker API interface represents the scope of a service worker client that is a document in a browser context, controlled by an active worker. The service worker client independently selects and uses a service worker for its own loading and sub-resources.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WindowClient)
 */
interface WindowClient extends Client {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WindowClient/focused) */
    readonly focused: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WindowClient/visibilityState) */
    readonly visibilityState: DocumentVisibilityState;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WindowClient/focus) */
    focus(): Promise<WindowClient>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WindowClient/navigate) */
    navigate(url: string | URL): Promise<WindowClient | null>;
}

declare var WindowClient: {
    prototype: WindowClient;
    new(): WindowClient;
};

interface WindowOrWorkerGlobalScope {
    /**
     * Available only in secure contexts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/caches)
     */
    readonly caches: CacheStorage;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/crossOriginIsolated) */
    readonly crossOriginIsolated: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/crypto) */
    readonly crypto: Crypto;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/indexedDB) */
    readonly indexedDB: IDBFactory;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/isSecureContext) */
    readonly isSecureContext: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/origin) */
    readonly origin: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/performance) */
    readonly performance: Performance;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/atob) */
    atob(data: string): string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/btoa) */
    btoa(data: string): string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/clearInterval) */
    clearInterval(id: number | undefined): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/clearTimeout) */
    clearTimeout(id: number | undefined): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/createImageBitmap) */
    createImageBitmap(image: ImageBitmapSource, options?: ImageBitmapOptions): Promise<ImageBitmap>;
    createImageBitmap(image: ImageBitmapSource, sx: number, sy: number, sw: number, sh: number, options?: ImageBitmapOptions): Promise<ImageBitmap>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch) */
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/queueMicrotask) */
    queueMicrotask(callback: VoidFunction): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/reportError) */
    reportError(e: any): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/setInterval) */
    setInterval(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/setTimeout) */
    setTimeout(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/structuredClone) */
    structuredClone<T = any>(value: T, options?: StructuredSerializeOptions): T;
}

interface WorkerEventMap extends AbstractWorkerEventMap, MessageEventTargetEventMap {
}

/**
 * This Web Workers API interface represents a background task that can be easily created and can send messages back to its creator. Creating a worker is as simple as calling the Worker() constructor and specifying a script to be run in the worker thread.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Worker)
 */
interface Worker extends EventTarget, AbstractWorker, MessageEventTarget<Worker> {
    /**
     * Clones message and transmits it to worker's global environment. transfer can be passed as a list of objects that are to be transferred rather than cloned.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Worker/postMessage)
     */
    postMessage(message: any, transfer: Transferable[]): void;
    postMessage(message: any, options?: StructuredSerializeOptions): void;
    /**
     * Aborts worker's associated global environment.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Worker/terminate)
     */
    terminate(): void;
    addEventListener<K extends keyof WorkerEventMap>(type: K, listener: (this: Worker, ev: WorkerEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof WorkerEventMap>(type: K, listener: (this: Worker, ev: WorkerEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var Worker: {
    prototype: Worker;
    new(scriptURL: string | URL, options?: WorkerOptions): Worker;
};

interface WorkerGlobalScopeEventMap {
    "error": ErrorEvent;
    "languagechange": Event;
    "offline": Event;
    "online": Event;
    "rejectionhandled": PromiseRejectionEvent;
    "unhandledrejection": PromiseRejectionEvent;
}

/**
 * This Web Workers API interface is an interface representing the scope of any worker. Workers have no browsing context; this scope contains the information usually conveyed by Window objects — in this case event handlers, the console or the associated WorkerNavigator object. Each WorkerGlobalScope has its own event loop.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope)
 */
interface WorkerGlobalScope extends EventTarget, FontFaceSource, WindowOrWorkerGlobalScope {
    /**
     * Returns workerGlobal's WorkerLocation object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/location)
     */
    readonly location: WorkerLocation;
    /**
     * Returns workerGlobal's WorkerNavigator object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/navigator)
     */
    readonly navigator: WorkerNavigator;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/error_event) */
    onerror: ((this: WorkerGlobalScope, ev: ErrorEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/languagechange_event) */
    onlanguagechange: ((this: WorkerGlobalScope, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/offline_event) */
    onoffline: ((this: WorkerGlobalScope, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/online_event) */
    ononline: ((this: WorkerGlobalScope, ev: Event) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/rejectionhandled_event) */
    onrejectionhandled: ((this: WorkerGlobalScope, ev: PromiseRejectionEvent) => any) | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/unhandledrejection_event) */
    onunhandledrejection: ((this: WorkerGlobalScope, ev: PromiseRejectionEvent) => any) | null;
    /**
     * Returns workerGlobal.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/self)
     */
    readonly self: WorkerGlobalScope & typeof globalThis;
    /**
     * Fetches each URL in urls, executes them one-by-one in the order they are passed, and then returns (or throws if something went amiss).
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/importScripts)
     */
    importScripts(...urls: (string | URL)[]): void;
    addEventListener<K extends keyof WorkerGlobalScopeEventMap>(type: K, listener: (this: WorkerGlobalScope, ev: WorkerGlobalScopeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof WorkerGlobalScopeEventMap>(type: K, listener: (this: WorkerGlobalScope, ev: WorkerGlobalScopeEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var WorkerGlobalScope: {
    prototype: WorkerGlobalScope;
    new(): WorkerGlobalScope;
};

/**
 * The absolute location of the script executed by the Worker. Such an object is initialized for each worker and is available via the WorkerGlobalScope.location property obtained by calling self.location.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation)
 */
interface WorkerLocation {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/hash) */
    readonly hash: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/host) */
    readonly host: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/hostname) */
    readonly hostname: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/href) */
    readonly href: string;
    toString(): string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/origin) */
    readonly origin: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/pathname) */
    readonly pathname: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/port) */
    readonly port: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/protocol) */
    readonly protocol: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerLocation/search) */
    readonly search: string;
}

declare var WorkerLocation: {
    prototype: WorkerLocation;
    new(): WorkerLocation;
};

/**
 * A subset of the Navigator interface allowed to be accessed from a Worker. Such an object is initialized for each worker and is available via the WorkerGlobalScope.navigator property obtained by calling window.self.navigator.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerNavigator)
 */
interface WorkerNavigator extends NavigatorBadge, NavigatorConcurrentHardware, NavigatorID, NavigatorLanguage, NavigatorLocks, NavigatorOnLine, NavigatorStorage {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerNavigator/mediaCapabilities) */
    readonly mediaCapabilities: MediaCapabilities;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerNavigator/permissions) */
    readonly permissions: Permissions;
    /**
     * Available only in secure contexts.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerNavigator/serviceWorker)
     */
    readonly serviceWorker: ServiceWorkerContainer;
}

declare var WorkerNavigator: {
    prototype: WorkerNavigator;
    new(): WorkerNavigator;
};

/**
 * This Streams API interface provides a standard abstraction for writing streaming data to a destination, known as a sink. This object comes with built-in backpressure and queuing.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream)
 */
interface WritableStream<W = any> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream/locked) */
    readonly locked: boolean;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream/abort) */
    abort(reason?: any): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream/close) */
    close(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStream/getWriter) */
    getWriter(): WritableStreamDefaultWriter<W>;
}

declare var WritableStream: {
    prototype: WritableStream;
    new<W = any>(underlyingSink?: UnderlyingSink<W>, strategy?: QueuingStrategy<W>): WritableStream<W>;
};

/**
 * This Streams API interface represents a controller allowing control of a WritableStream's state. When constructing a WritableStream, the underlying sink is given a corresponding WritableStreamDefaultController instance to manipulate.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultController)
 */
interface WritableStreamDefaultController {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultController/signal) */
    readonly signal: AbortSignal;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultController/error) */
    error(e?: any): void;
}

declare var WritableStreamDefaultController: {
    prototype: WritableStreamDefaultController;
    new(): WritableStreamDefaultController;
};

/**
 * This Streams API interface is the object returned by WritableStream.getWriter() and once created locks the < writer to the WritableStream ensuring that no other streams can write to the underlying sink.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter)
 */
interface WritableStreamDefaultWriter<W = any> {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/closed) */
    readonly closed: Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/desiredSize) */
    readonly desiredSize: number | null;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/ready) */
    readonly ready: Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/abort) */
    abort(reason?: any): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/close) */
    close(): Promise<void>;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/releaseLock) */
    releaseLock(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WritableStreamDefaultWriter/write) */
    write(chunk?: W): Promise<void>;
}

declare var WritableStreamDefaultWriter: {
    prototype: WritableStreamDefaultWriter;
    new<W = any>(stream: WritableStream<W>): WritableStreamDefaultWriter<W>;
};

interface XMLHttpRequestEventMap extends XMLHttpRequestEventTargetEventMap {
    "readystatechange": Event;
}

/**
 * Use XMLHttpRequest (XHR) objects to interact with servers. You can retrieve data from a URL without having to do a full page refresh. This enables a Web page to update just part of a page without disrupting what the user is doing.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest)
 */
interface XMLHttpRequest extends XMLHttpRequestEventTarget {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/readystatechange_event) */
    onreadystatechange: ((this: XMLHttpRequest, ev: Event) => any) | null;
    /**
     * Returns client's state.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/readyState)
     */
    readonly readyState: number;
    /**
     * Returns the response body.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/response)
     */
    readonly response: any;
    /**
     * Returns response as text.
     *
     * Throws an "InvalidStateError" DOMException if responseType is not the empty string or "text".
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/responseText)
     */
    readonly responseText: string;
    /**
     * Returns the response type.
     *
     * Can be set to change the response type. Values are: the empty string (default), "arraybuffer", "blob", "document", "json", and "text".
     *
     * When set: setting to "document" is ignored if current global object is not a Window object.
     *
     * When set: throws an "InvalidStateError" DOMException if state is loading or done.
     *
     * When set: throws an "InvalidAccessError" DOMException if the synchronous flag is set and current global object is a Window object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/responseType)
     */
    responseType: XMLHttpRequestResponseType;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/responseURL) */
    readonly responseURL: string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/status) */
    readonly status: number;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/statusText) */
    readonly statusText: string;
    /**
     * Can be set to a time in milliseconds. When set to a non-zero value will cause fetching to terminate after the given time has passed. When the time has passed, the request has not yet completed, and this's synchronous flag is unset, a timeout event will then be dispatched, or a "TimeoutError" DOMException will be thrown otherwise (for the send() method).
     *
     * When set: throws an "InvalidAccessError" DOMException if the synchronous flag is set and current global object is a Window object.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/timeout)
     */
    timeout: number;
    /**
     * Returns the associated XMLHttpRequestUpload object. It can be used to gather transmission information when data is transferred to a server.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/upload)
     */
    readonly upload: XMLHttpRequestUpload;
    /**
     * True when credentials are to be included in a cross-origin request. False when they are to be excluded in a cross-origin request and when cookies are to be ignored in its response. Initially false.
     *
     * When set: throws an "InvalidStateError" DOMException if state is not unsent or opened, or if the send() flag is set.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/withCredentials)
     */
    withCredentials: boolean;
    /**
     * Cancels any network activity.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/abort)
     */
    abort(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/getAllResponseHeaders) */
    getAllResponseHeaders(): string;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/getResponseHeader) */
    getResponseHeader(name: string): string | null;
    /**
     * Sets the request method, request URL, and synchronous flag.
     *
     * Throws a "SyntaxError" DOMException if either method is not a valid method or url cannot be parsed.
     *
     * Throws a "SecurityError" DOMException if method is a case-insensitive match for `CONNECT`, `TRACE`, or `TRACK`.
     *
     * Throws an "InvalidAccessError" DOMException if async is false, current global object is a Window object, and the timeout attribute is not zero or the responseType attribute is not the empty string.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/open)
     */
    open(method: string, url: string | URL): void;
    open(method: string, url: string | URL, async: boolean, username?: string | null, password?: string | null): void;
    /**
     * Acts as if the `Content-Type` header value for a response is mime. (It does not change the header.)
     *
     * Throws an "InvalidStateError" DOMException if state is loading or done.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/overrideMimeType)
     */
    overrideMimeType(mime: string): void;
    /**
     * Initiates the request. The body argument provides the request body, if any, and is ignored if the request method is GET or HEAD.
     *
     * Throws an "InvalidStateError" DOMException if either state is not opened or the send() flag is set.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/send)
     */
    send(body?: XMLHttpRequestBodyInit | null): void;
    /**
     * Combines a header in author request headers.
     *
     * Throws an "InvalidStateError" DOMException if either state is not opened or the send() flag is set.
     *
     * Throws a "SyntaxError" DOMException if name is not a header name or if value is not a header value.
     *
     * [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequest/setRequestHeader)
     */
    setRequestHeader(name: string, value: string): void;
    readonly UNSENT: 0;
    readonly OPENED: 1;
    readonly HEADERS_RECEIVED: 2;
    readonly LOADING: 3;
    readonly DONE: 4;
    addEventListener<K extends keyof XMLHttpRequestEventMap>(type: K, listener: (this: XMLHttpRequest, ev: XMLHttpRequestEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof XMLHttpRequestEventMap>(type: K, listener: (this: XMLHttpRequest, ev: XMLHttpRequestEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var XMLHttpRequest: {
    prototype: XMLHttpRequest;
    new(): XMLHttpRequest;
    readonly UNSENT: 0;
    readonly OPENED: 1;
    readonly HEADERS_RECEIVED: 2;
    readonly LOADING: 3;
    readonly DONE: 4;
};

interface XMLHttpRequestEventTargetEventMap {
    "abort": ProgressEvent<XMLHttpRequestEventTarget>;
    "error": ProgressEvent<XMLHttpRequestEventTarget>;
    "load": ProgressEvent<XMLHttpRequestEventTarget>;
    "loadend": ProgressEvent<XMLHttpRequestEventTarget>;
    "loadstart": ProgressEvent<XMLHttpRequestEventTarget>;
    "progress": ProgressEvent<XMLHttpRequestEventTarget>;
    "timeout": ProgressEvent<XMLHttpRequestEventTarget>;
}

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequestEventTarget) */
interface XMLHttpRequestEventTarget extends EventTarget {
    onabort: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    onerror: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    onload: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    onloadend: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    onloadstart: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    onprogress: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    ontimeout: ((this: XMLHttpRequest, ev: ProgressEvent) => any) | null;
    addEventListener<K extends keyof XMLHttpRequestEventTargetEventMap>(type: K, listener: (this: XMLHttpRequestEventTarget, ev: XMLHttpRequestEventTargetEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof XMLHttpRequestEventTargetEventMap>(type: K, listener: (this: XMLHttpRequestEventTarget, ev: XMLHttpRequestEventTargetEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var XMLHttpRequestEventTarget: {
    prototype: XMLHttpRequestEventTarget;
    new(): XMLHttpRequestEventTarget;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/XMLHttpRequestUpload) */
interface XMLHttpRequestUpload extends XMLHttpRequestEventTarget {
    addEventListener<K extends keyof XMLHttpRequestEventTargetEventMap>(type: K, listener: (this: XMLHttpRequestUpload, ev: XMLHttpRequestEventTargetEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
    addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
    removeEventListener<K extends keyof XMLHttpRequestEventTargetEventMap>(type: K, listener: (this: XMLHttpRequestUpload, ev: XMLHttpRequestEventTargetEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
    removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
}

declare var XMLHttpRequestUpload: {
    prototype: XMLHttpRequestUpload;
    new(): XMLHttpRequestUpload;
};

/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console) */
interface Console {
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/assert_static) */
    assert(condition?: boolean, ...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/clear_static) */
    clear(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/count_static) */
    count(label?: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/countReset_static) */
    countReset(label?: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/debug_static) */
    debug(...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/dir_static) */
    dir(item?: any, options?: any): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/dirxml_static) */
    dirxml(...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/error_static) */
    error(...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/group_static) */
    group(...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/groupCollapsed_static) */
    groupCollapsed(...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/groupEnd_static) */
    groupEnd(): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/info_static) */
    info(...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/log_static) */
    log(...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/table_static) */
    table(tabularData?: any, properties?: string[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/time_static) */
    time(label?: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/timeEnd_static) */
    timeEnd(label?: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/timeLog_static) */
    timeLog(label?: string, ...data: any[]): void;
    timeStamp(label?: string): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/trace_static) */
    trace(...data: any[]): void;
    /** [MDN Reference](https://developer.mozilla.org/docs/Web/API/console/warn_static) */
    warn(...data: any[]): void;
}

declare var console: Console;

declare namespace WebAssembly {
    interface CompileError extends Error {
    }

    var CompileError: {
        prototype: CompileError;
        new(message?: string): CompileError;
        (message?: string): CompileError;
    };

    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Global) */
    interface Global<T extends ValueType = ValueType> {
        value: ValueTypeMap[T];
        valueOf(): ValueTypeMap[T];
    }

    var Global: {
        prototype: Global;
        new<T extends ValueType = ValueType>(descriptor: GlobalDescriptor<T>, v?: ValueTypeMap[T]): Global<T>;
    };

    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Instance) */
    interface Instance {
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Instance/exports) */
        readonly exports: Exports;
    }

    var Instance: {
        prototype: Instance;
        new(module: Module, importObject?: Imports): Instance;
    };

    interface LinkError extends Error {
    }

    var LinkError: {
        prototype: LinkError;
        new(message?: string): LinkError;
        (message?: string): LinkError;
    };

    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Memory) */
    interface Memory {
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Memory/buffer) */
        readonly buffer: ArrayBuffer;
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Memory/grow) */
        grow(delta: number): number;
    }

    var Memory: {
        prototype: Memory;
        new(descriptor: MemoryDescriptor): Memory;
    };

    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Module) */
    interface Module {
    }

    var Module: {
        prototype: Module;
        new(bytes: BufferSource): Module;
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Module/customSections_static) */
        customSections(moduleObject: Module, sectionName: string): ArrayBuffer[];
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Module/exports_static) */
        exports(moduleObject: Module): ModuleExportDescriptor[];
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Module/imports_static) */
        imports(moduleObject: Module): ModuleImportDescriptor[];
    };

    interface RuntimeError extends Error {
    }

    var RuntimeError: {
        prototype: RuntimeError;
        new(message?: string): RuntimeError;
        (message?: string): RuntimeError;
    };

    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Table) */
    interface Table {
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Table/length) */
        readonly length: number;
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Table/get) */
        get(index: number): any;
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Table/grow) */
        grow(delta: number, value?: any): number;
        /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/Table/set) */
        set(index: number, value?: any): void;
    }

    var Table: {
        prototype: Table;
        new(descriptor: TableDescriptor, value?: any): Table;
    };

    interface GlobalDescriptor<T extends ValueType = ValueType> {
        mutable?: boolean;
        value: T;
    }

    interface MemoryDescriptor {
        initial: number;
        maximum?: number;
        shared?: boolean;
    }

    interface ModuleExportDescriptor {
        kind: ImportExportKind;
        name: string;
    }

    interface ModuleImportDescriptor {
        kind: ImportExportKind;
        module: string;
        name: string;
    }

    interface TableDescriptor {
        element: TableKind;
        initial: number;
        maximum?: number;
    }

    interface ValueTypeMap {
        anyfunc: Function;
        externref: any;
        f32: number;
        f64: number;
        i32: number;
        i64: bigint;
        v128: never;
    }

    interface WebAssemblyInstantiatedSource {
        instance: Instance;
        module: Module;
    }

    type ImportExportKind = "function" | "global" | "memory" | "table";
    type TableKind = "anyfunc" | "externref";
    type ExportValue = Function | Global | Memory | Table;
    type Exports = Record<string, ExportValue>;
    type ImportValue = ExportValue | number;
    type Imports = Record<string, ModuleImports>;
    type ModuleImports = Record<string, ImportValue>;
    type ValueType = keyof ValueTypeMap;
    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/compile_static) */
    function compile(bytes: BufferSource): Promise<Module>;
    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/compileStreaming_static) */
    function compileStreaming(source: Response | PromiseLike<Response>): Promise<Module>;
    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/instantiate_static) */
    function instantiate(bytes: BufferSource, importObject?: Imports): Promise<WebAssemblyInstantiatedSource>;
    function instantiate(moduleObject: Module, importObject?: Imports): Promise<Instance>;
    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/instantiateStreaming_static) */
    function instantiateStreaming(source: Response | PromiseLike<Response>, importObject?: Imports): Promise<WebAssemblyInstantiatedSource>;
    /** [MDN Reference](https://developer.mozilla.org/docs/WebAssembly/JavaScript_interface/validate_static) */
    function validate(bytes: BufferSource): boolean;
}

interface AudioDataOutputCallback {
    (output: AudioData): void;
}

interface EncodedAudioChunkOutputCallback {
    (output: EncodedAudioChunk, metadata?: EncodedAudioChunkMetadata): void;
}

interface EncodedVideoChunkOutputCallback {
    (chunk: EncodedVideoChunk, metadata?: EncodedVideoChunkMetadata): void;
}

interface FrameRequestCallback {
    (time: DOMHighResTimeStamp): void;
}

interface LockGrantedCallback {
    (lock: Lock | null): any;
}

interface OnErrorEventHandlerNonNull {
    (event: Event | string, source?: string, lineno?: number, colno?: number, error?: Error): any;
}

interface PerformanceObserverCallback {
    (entries: PerformanceObserverEntryList, observer: PerformanceObserver): void;
}

interface QueuingStrategySize<T = any> {
    (chunk: T): number;
}

interface ReportingObserverCallback {
    (reports: Report[], observer: ReportingObserver): void;
}

interface TransformerFlushCallback<O> {
    (controller: TransformStreamDefaultController<O>): void | PromiseLike<void>;
}

interface TransformerStartCallback<O> {
    (controller: TransformStreamDefaultController<O>): any;
}

interface TransformerTransformCallback<I, O> {
    (chunk: I, controller: TransformStreamDefaultController<O>): void | PromiseLike<void>;
}

interface UnderlyingSinkAbortCallback {
    (reason?: any): void | PromiseLike<void>;
}

interface UnderlyingSinkCloseCallback {
    (): void | PromiseLike<void>;
}

interface UnderlyingSinkStartCallback {
    (controller: WritableStreamDefaultController): any;
}

interface UnderlyingSinkWriteCallback<W> {
    (chunk: W, controller: WritableStreamDefaultController): void | PromiseLike<void>;
}

interface UnderlyingSourceCancelCallback {
    (reason?: any): void | PromiseLike<void>;
}

interface UnderlyingSourcePullCallback<R> {
    (controller: ReadableStreamController<R>): void | PromiseLike<void>;
}

interface UnderlyingSourceStartCallback<R> {
    (controller: ReadableStreamController<R>): any;
}

interface VideoFrameOutputCallback {
    (output: VideoFrame): void;
}

interface VoidFunction {
    (): void;
}

interface WebCodecsErrorCallback {
    (error: DOMException): void;
}

/**
 * Returns dedicatedWorkerGlobal's name, i.e. the value given to the Worker constructor. Primarily useful for debugging.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/name)
 */
declare var name: string;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/rtctransform_event) */
declare var onrtctransform: ((this: DedicatedWorkerGlobalScope, ev: RTCTransformEvent) => any) | null;
/**
 * Aborts dedicatedWorkerGlobal.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/close)
 */
declare function close(): void;
/**
 * Clones message and transmits it to the Worker object associated with dedicatedWorkerGlobal. transfer can be passed as a list of objects that are to be transferred rather than cloned.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/postMessage)
 */
declare function postMessage(message: any, transfer: Transferable[]): void;
declare function postMessage(message: any, options?: StructuredSerializeOptions): void;
/**
 * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)
 */
declare function dispatchEvent(event: Event): boolean;
/**
 * Returns workerGlobal's WorkerLocation object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/location)
 */
declare var location: WorkerLocation;
/**
 * Returns workerGlobal's WorkerNavigator object.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/navigator)
 */
declare var navigator: WorkerNavigator;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/error_event) */
declare var onerror: ((this: DedicatedWorkerGlobalScope, ev: ErrorEvent) => any) | null;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/languagechange_event) */
declare var onlanguagechange: ((this: DedicatedWorkerGlobalScope, ev: Event) => any) | null;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/offline_event) */
declare var onoffline: ((this: DedicatedWorkerGlobalScope, ev: Event) => any) | null;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/online_event) */
declare var ononline: ((this: DedicatedWorkerGlobalScope, ev: Event) => any) | null;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/rejectionhandled_event) */
declare var onrejectionhandled: ((this: DedicatedWorkerGlobalScope, ev: PromiseRejectionEvent) => any) | null;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/unhandledrejection_event) */
declare var onunhandledrejection: ((this: DedicatedWorkerGlobalScope, ev: PromiseRejectionEvent) => any) | null;
/**
 * Returns workerGlobal.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/self)
 */
declare var self: WorkerGlobalScope & typeof globalThis;
/**
 * Fetches each URL in urls, executes them one-by-one in the order they are passed, and then returns (or throws if something went amiss).
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/WorkerGlobalScope/importScripts)
 */
declare function importScripts(...urls: (string | URL)[]): void;
/**
 * Dispatches a synthetic event event to target and returns true if either event's cancelable attribute value is false or its preventDefault() method was not invoked, and false otherwise.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/EventTarget/dispatchEvent)
 */
declare function dispatchEvent(event: Event): boolean;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Document/fonts) */
declare var fonts: FontFaceSet;
/**
 * Available only in secure contexts.
 *
 * [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/caches)
 */
declare var caches: CacheStorage;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/crossOriginIsolated) */
declare var crossOriginIsolated: boolean;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/crypto) */
declare var crypto: Crypto;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/indexedDB) */
declare var indexedDB: IDBFactory;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/isSecureContext) */
declare var isSecureContext: boolean;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/origin) */
declare var origin: string;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/performance) */
declare var performance: Performance;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/atob) */
declare function atob(data: string): string;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/btoa) */
declare function btoa(data: string): string;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/clearInterval) */
declare function clearInterval(id: number | undefined): void;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/clearTimeout) */
declare function clearTimeout(id: number | undefined): void;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/createImageBitmap) */
declare function createImageBitmap(image: ImageBitmapSource, options?: ImageBitmapOptions): Promise<ImageBitmap>;
declare function createImageBitmap(image: ImageBitmapSource, sx: number, sy: number, sw: number, sh: number, options?: ImageBitmapOptions): Promise<ImageBitmap>;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/fetch) */
declare function fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/queueMicrotask) */
declare function queueMicrotask(callback: VoidFunction): void;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/reportError) */
declare function reportError(e: any): void;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/setInterval) */
declare function setInterval(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/setTimeout) */
declare function setTimeout(handler: TimerHandler, timeout?: number, ...arguments: any[]): number;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/Window/structuredClone) */
declare function structuredClone<T = any>(value: T, options?: StructuredSerializeOptions): T;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/cancelAnimationFrame) */
declare function cancelAnimationFrame(handle: number): void;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/requestAnimationFrame) */
declare function requestAnimationFrame(callback: FrameRequestCallback): number;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/message_event) */
declare var onmessage: ((this: DedicatedWorkerGlobalScope, ev: MessageEvent) => any) | null;
/** [MDN Reference](https://developer.mozilla.org/docs/Web/API/DedicatedWorkerGlobalScope/messageerror_event) */
declare var onmessageerror: ((this: DedicatedWorkerGlobalScope, ev: MessageEvent) => any) | null;
declare function addEventListener<K extends keyof DedicatedWorkerGlobalScopeEventMap>(type: K, listener: (this: DedicatedWorkerGlobalScope, ev: DedicatedWorkerGlobalScopeEventMap[K]) => any, options?: boolean | AddEventListenerOptions): void;
declare function addEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | AddEventListenerOptions): void;
declare function removeEventListener<K extends keyof DedicatedWorkerGlobalScopeEventMap>(type: K, listener: (this: DedicatedWorkerGlobalScope, ev: DedicatedWorkerGlobalScopeEventMap[K]) => any, options?: boolean | EventListenerOptions): void;
declare function removeEventListener(type: string, listener: EventListenerOrEventListenerObject, options?: boolean | EventListenerOptions): void;
type AlgorithmIdentifier = Algorithm | string;
type AllowSharedBufferSource = ArrayBuffer | ArrayBufferView;
type BigInteger = Uint8Array;
type BlobPart = BufferSource | Blob | string;
type BodyInit = ReadableStream | XMLHttpRequestBodyInit;
type BufferSource = ArrayBufferView | ArrayBuffer;
type CSSKeywordish = string | CSSKeywordValue;
type CSSNumberish = number | CSSNumericValue;
type CSSPerspectiveValue = CSSNumericValue | CSSKeywordish;
type CSSUnparsedSegment = string | CSSVariableReferenceValue;
type CanvasImageSource = ImageBitmap | OffscreenCanvas | VideoFrame;
type DOMHighResTimeStamp = number;
type EpochTimeStamp = number;
type EventListenerOrEventListenerObject = EventListener | EventListenerObject;
type FileSystemWriteChunkType = BufferSource | Blob | string | WriteParams;
type Float32List = Float32Array | GLfloat[];
type FormDataEntryValue = File | string;
type GLbitfield = number;
type GLboolean = boolean;
type GLclampf = number;
type GLenum = number;
type GLfloat = number;
type GLint = number;
type GLint64 = number;
type GLintptr = number;
type GLsizei = number;
type GLsizeiptr = number;
type GLuint = number;
type GLuint64 = number;
type HashAlgorithmIdentifier = AlgorithmIdentifier;
type HeadersInit = [string, string][] | Record<string, string> | Headers;
type IDBValidKey = number | string | Date | BufferSource | IDBValidKey[];
type ImageBitmapSource = CanvasImageSource | Blob | ImageData;
type ImageBufferSource = AllowSharedBufferSource | ReadableStream;
type Int32List = Int32Array | GLint[];
type MessageEventSource = MessagePort | ServiceWorker;
type NamedCurve = string;
type OffscreenRenderingContext = OffscreenCanvasRenderingContext2D | ImageBitmapRenderingContext | WebGLRenderingContext | WebGL2RenderingContext;
type OnErrorEventHandler = OnErrorEventHandlerNonNull | null;
type PerformanceEntryList = PerformanceEntry[];
type PushMessageDataInit = BufferSource | string;
type ReadableStreamController<T> = ReadableStreamDefaultController<T> | ReadableByteStreamController;
type ReadableStreamReadResult<T> = ReadableStreamReadValueResult<T> | ReadableStreamReadDoneResult<T>;
type ReadableStreamReader<T> = ReadableStreamDefaultReader<T> | ReadableStreamBYOBReader;
type ReportList = Report[];
type RequestInfo = Request | string;
type TexImageSource = ImageBitmap | ImageData | OffscreenCanvas | VideoFrame;
type TimerHandler = string | Function;
type Transferable = OffscreenCanvas | ImageBitmap | MessagePort | MediaSourceHandle | ReadableStream | WritableStream | TransformStream | AudioData | VideoFrame | RTCDataChannel | ArrayBuffer;
type Uint32List = Uint32Array | GLuint[];
type XMLHttpRequestBodyInit = Blob | BufferSource | FormData | URLSearchParams | string;
type AlphaOption = "discard" | "keep";
type AudioSampleFormat = "f32" | "f32-planar" | "s16" | "s16-planar" | "s32" | "s32-planar" | "u8" | "u8-planar";
type AvcBitstreamFormat = "annexb" | "avc";
type BinaryType = "arraybuffer" | "blob";
type BitrateMode = "constant" | "variable";
type CSSMathOperator = "clamp" | "invert" | "max" | "min" | "negate" | "product" | "sum";
type CSSNumericBaseType = "angle" | "flex" | "frequency" | "length" | "percent" | "resolution" | "time";
type CanvasDirection = "inherit" | "ltr" | "rtl";
type CanvasFillRule = "evenodd" | "nonzero";
type CanvasFontKerning = "auto" | "none" | "normal";
type CanvasFontStretch = "condensed" | "expanded" | "extra-condensed" | "extra-expanded" | "normal" | "semi-condensed" | "semi-expanded" | "ultra-condensed" | "ultra-expanded";
type CanvasFontVariantCaps = "all-petite-caps" | "all-small-caps" | "normal" | "petite-caps" | "small-caps" | "titling-caps" | "unicase";
type CanvasLineCap = "butt" | "round" | "square";
type CanvasLineJoin = "bevel" | "miter" | "round";
type CanvasTextAlign = "center" | "end" | "left" | "right" | "start";
type CanvasTextBaseline = "alphabetic" | "bottom" | "hanging" | "ideographic" | "middle" | "top";
type CanvasTextRendering = "auto" | "geometricPrecision" | "optimizeLegibility" | "optimizeSpeed";
type ClientTypes = "all" | "sharedworker" | "window" | "worker";
type CodecState = "closed" | "configured" | "unconfigured";
type ColorGamut = "p3" | "rec2020" | "srgb";
type ColorSpaceConversion = "default" | "none";
type CompressionFormat = "deflate" | "deflate-raw" | "gzip";
type DocumentVisibilityState = "hidden" | "visible";
type EncodedAudioChunkType = "delta" | "key";
type EncodedVideoChunkType = "delta" | "key";
type EndingType = "native" | "transparent";
type FileSystemHandleKind = "directory" | "file";
type FontDisplay = "auto" | "block" | "fallback" | "optional" | "swap";
type FontFaceLoadStatus = "error" | "loaded" | "loading" | "unloaded";
type FontFaceSetLoadStatus = "loaded" | "loading";
type FrameType = "auxiliary" | "nested" | "none" | "top-level";
type GlobalCompositeOperation = "color" | "color-burn" | "color-dodge" | "copy" | "darken" | "destination-atop" | "destination-in" | "destination-out" | "destination-over" | "difference" | "exclusion" | "hard-light" | "hue" | "lighten" | "lighter" | "luminosity" | "multiply" | "overlay" | "saturation" | "screen" | "soft-light" | "source-atop" | "source-in" | "source-out" | "source-over" | "xor";
type HardwareAcceleration = "no-preference" | "prefer-hardware" | "prefer-software";
type HdrMetadataType = "smpteSt2086" | "smpteSt2094-10" | "smpteSt2094-40";
type IDBCursorDirection = "next" | "nextunique" | "prev" | "prevunique";
type IDBRequestReadyState = "done" | "pending";
type IDBTransactionDurability = "default" | "relaxed" | "strict";
type IDBTransactionMode = "readonly" | "readwrite" | "versionchange";
type ImageOrientation = "flipY" | "from-image" | "none";
type ImageSmoothingQuality = "high" | "low" | "medium";
type KeyFormat = "jwk" | "pkcs8" | "raw" | "spki";
type KeyType = "private" | "public" | "secret";
type KeyUsage = "decrypt" | "deriveBits" | "deriveKey" | "encrypt" | "sign" | "unwrapKey" | "verify" | "wrapKey";
type LatencyMode = "quality" | "realtime";
type LockMode = "exclusive" | "shared";
type MediaDecodingType = "file" | "media-source" | "webrtc";
type MediaEncodingType = "record" | "webrtc";
type NotificationDirection = "auto" | "ltr" | "rtl";
type NotificationPermission = "default" | "denied" | "granted";
type OffscreenRenderingContextId = "2d" | "bitmaprenderer" | "webgl" | "webgl2" | "webgpu";
type OpusBitstreamFormat = "ogg" | "opus";
type PermissionName = "camera" | "geolocation" | "microphone" | "midi" | "notifications" | "persistent-storage" | "push" | "screen-wake-lock" | "storage-access";
type PermissionState = "denied" | "granted" | "prompt";
type PredefinedColorSpace = "display-p3" | "srgb";
type PremultiplyAlpha = "default" | "none" | "premultiply";
type PushEncryptionKeyName = "auth" | "p256dh";
type RTCDataChannelState = "closed" | "closing" | "connecting" | "open";
type RTCEncodedVideoFrameType = "delta" | "empty" | "key";
type ReadableStreamReaderMode = "byob";
type ReadableStreamType = "bytes";
type ReferrerPolicy = "" | "no-referrer" | "no-referrer-when-downgrade" | "origin" | "origin-when-cross-origin" | "same-origin" | "strict-origin" | "strict-origin-when-cross-origin" | "unsafe-url";
type RequestCache = "default" | "force-cache" | "no-cache" | "no-store" | "only-if-cached" | "reload";
type RequestCredentials = "include" | "omit" | "same-origin";
type RequestDestination = "" | "audio" | "audioworklet" | "document" | "embed" | "font" | "frame" | "iframe" | "image" | "manifest" | "object" | "paintworklet" | "report" | "script" | "sharedworker" | "style" | "track" | "video" | "worker" | "xslt";
type RequestMode = "cors" | "navigate" | "no-cors" | "same-origin";
type RequestPriority = "auto" | "high" | "low";
type RequestRedirect = "error" | "follow" | "manual";
type ResizeQuality = "high" | "low" | "medium" | "pixelated";
type ResponseType = "basic" | "cors" | "default" | "error" | "opaque" | "opaqueredirect";
type SecurityPolicyViolationEventDisposition = "enforce" | "report";
type ServiceWorkerState = "activated" | "activating" | "installed" | "installing" | "parsed" | "redundant";
type ServiceWorkerUpdateViaCache = "all" | "imports" | "none";
type TransferFunction = "hlg" | "pq" | "srgb";
type VideoColorPrimaries = "bt470bg" | "bt709" | "smpte170m";
type VideoEncoderBitrateMode = "constant" | "quantizer" | "variable";
type VideoMatrixCoefficients = "bt470bg" | "bt709" | "rgb" | "smpte170m";
type VideoPixelFormat = "BGRA" | "BGRX" | "I420" | "I420A" | "I422" | "I444" | "NV12" | "RGBA" | "RGBX";
type VideoTransferCharacteristics = "bt709" | "iec61966-2-1" | "smpte170m";
type WebGLPowerPreference = "default" | "high-performance" | "low-power";
type WebTransportCongestionControl = "default" | "low-latency" | "throughput";
type WebTransportErrorSource = "session" | "stream";
type WorkerType = "classic" | "module";
type WriteCommandType = "seek" | "truncate" | "write";
type XMLHttpRequestResponseType = "" | "arraybuffer" | "blob" | "document" | "json" | "text";
