import { useEffect, useRef, useState, useMemo } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import cn from 'clsx';
import { useModal } from '@lib/hooks/useModal';
import { preventBubbling } from '@lib/utils';
import { combineBase64Images } from '@lib/utils/image-utils';
import { ImageModal } from '@components/modal/image-modal';
import { Modal } from '@components/modal/modal';
import { NextImage } from '@components/ui/next-image';
import { Button } from '@components/ui/button';
import { HeroIcon } from '@components/ui/hero-icon';
import { ToolTip } from '@components/ui/tooltip';
import type { MotionProps } from 'framer-motion';
import type { ImagesPreview, ImageData } from '@lib/types/file';

type ImagePreviewProps = {
    tweet?: boolean;
    viewTweet?: boolean;
    previewCount: number;
    imagesPreview: ImagesPreview;
    removeImage?: (targetId: string) => () => void;
};

const variants: MotionProps = {
    initial: { opacity: 0, scale: 0.5 },
    animate: {
        opacity: 1,
        scale: 1,
        transition: { duration: 0.3 }
    },
    exit: { opacity: 0, scale: 0.5 },
    transition: { type: 'spring', duration: 0.5 }
};

type PostImageBorderRadius = Record<number, string[]>;

const postImageBorderRadius: Readonly<PostImageBorderRadius> = {
    1: ['rounded-2xl'],
    2: ['rounded-tl-2xl rounded-bl-2xl', 'rounded-tr-2xl rounded-br-2xl'],
    3: ['rounded-tl-2xl rounded-bl-2xl', 'rounded-tr-2xl', 'rounded-br-2xl'],
    4: ['rounded-tl-2xl', 'rounded-tr-2xl', 'rounded-bl-2xl', 'rounded-br-2xl']
};

export function ImagePreview({
    tweet,
    viewTweet,
    previewCount: _previewCount, // Renamed to avoid unused variable warning
    imagesPreview,
    removeImage
}: ImagePreviewProps): JSX.Element {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedImage, setSelectedImage] = useState<ImageData | null>(null);

    const videoRef = useRef<HTMLVideoElement>(null);

    const { open, openModal, closeModal } = useModal();

    // Combine accidentally separated base64 images
    const processedImages = useMemo(() => {
        return combineBase64Images(imagesPreview);
    }, [imagesPreview]);

    // Update previewCount based on processed images
    const actualPreviewCount = processedImages.length;

    useEffect(() => {
        const imageData = processedImages[selectedIndex];
        setSelectedImage(imageData);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedIndex, processedImages]);

    const handleVideoStop = (): void => {
        if (videoRef.current) videoRef.current.pause();
    };

    const handleSelectedImage = (index: number, isVideo?: boolean) => () => {
        if (isVideo) handleVideoStop();

        setSelectedIndex(index);
        openModal();
    };

    const handleNextIndex = (type: 'prev' | 'next') => () => {
        const nextIndex =
            type === 'prev'
                ? selectedIndex === 0
                    ? actualPreviewCount - 1
                    : selectedIndex - 1
                : selectedIndex === actualPreviewCount - 1
                ? 0
                : selectedIndex + 1;

        setSelectedIndex(nextIndex);
    };

    const isTweet = tweet ?? viewTweet;

    return (
        <div
            className={cn(
                'grid grid-cols-2 grid-rows-2 rounded-2xl',
                viewTweet
                    ? 'h-[51vw] xs:h-[42vw] md:h-[305px]'
                    : 'h-[42vw] xs:h-[37vw] md:h-[271px]',
                isTweet ? 'mt-2 gap-0.5' : 'gap-3'
            )}
        >
            <Modal
                modalClassName={cn(
                    'flex justify-center w-full items-center relative',
                    isTweet && 'h-full'
                )}
                open={open}
                closeModal={closeModal}
                closePanelOnClick
            >
                <ImageModal
                    tweet={isTweet}
                    imageData={selectedImage as ImageData}
                    previewCount={actualPreviewCount}
                    selectedIndex={selectedIndex}
                    handleNextIndex={handleNextIndex}
                />
            </Modal>
            <AnimatePresence mode='popLayout'>
                {processedImages.map(({ id, src, alt }, index) => {
                    const isVideo =
                        processedImages[index].type?.includes('video');

                    return (
                        <motion.button
                            type='button'
                            className={cn(
                                'accent-tab group relative transition-shadow',
                                isTweet
                                    ? postImageBorderRadius[actualPreviewCount]?.[index] || 'rounded-2xl'
                                    : 'rounded-2xl',
                                {
                                    'col-span-2 row-span-2': actualPreviewCount === 1,
                                    'row-span-2':
                                        actualPreviewCount === 2 ||
                                        (index === 0 && actualPreviewCount === 3)
                                }
                            )}
                            {...variants}
                            onClick={preventBubbling(
                                handleSelectedImage(index, isVideo)
                            )}
                            layout={!isTweet ? true : false}
                            key={id}
                        >
                            {isVideo ? (
                                <>
                                    <Button
                                        className='visible absolute top-0 right-0 z-10 -translate-x-1 translate-y-1 
                               bg-light-primary/75 p-1 opacity-0 backdrop-blur-sm transition
                               hover:bg-image-preview-hover/75 group-hover:opacity-100 xs:invisible'
                                    >
                                        <HeroIcon
                                            className='h-5 w-5'
                                            iconName='ArrowUpRightIcon'
                                        />
                                    </Button>
                                    <video
                                        ref={videoRef}
                                        className={cn(
                                            `relative h-full w-full cursor-pointer transition 
                       hover:brightness-75 hover:duration-200`,
                                            isTweet
                                                ? postImageBorderRadius[
                                                      actualPreviewCount
                                                  ]?.[index] || 'rounded-2xl'
                                                : 'rounded-2xl'
                                        )}
                                        src={src}
                                        controls
                                        muted
                                    />
                                </>
                            ) : (
                                <NextImage
                                    className='relative h-full w-full cursor-pointer transition 
                             hover:brightness-75 hover:duration-200'
                                    imgClassName={cn(
                                        isTweet
                                            ? postImageBorderRadius[
                                                  actualPreviewCount
                                              ]?.[index] || 'rounded-2xl'
                                            : 'rounded-2xl'
                                    )}
                                    previewCount={actualPreviewCount}
                                    layout='fill'
                                    src={src}
                                    alt={alt}
                                    useSkeleton={isTweet}
                                />
                            )}
                            {removeImage && (
                                <Button
                                    className='group absolute top-0 left-0 translate-x-1 translate-y-1
                           bg-light-primary/75 p-1 backdrop-blur-sm 
                           hover:bg-image-preview-hover/75'
                                    onClick={preventBubbling(removeImage(id))}
                                >
                                    <HeroIcon
                                        className='h-5 w-5 text-white'
                                        iconName='XMarkIcon'
                                    />
                                    <ToolTip
                                        className='translate-y-2'
                                        tip='Remove'
                                    />
                                </Button>
                            )}
                        </motion.button>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
